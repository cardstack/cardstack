import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';
import '@ember/test-helpers';
import Fixtures from '@cardstack/test-support/fixtures';
import testDataSetup from '../helpers/test-data-setup';
import RSVP from 'rsvp';

module('Integration | @cardstack/data service load()', function (hooks) {
  setupTest(hooks);

  module('no defaultIncludes', function (hooks) {
    let scenario = new Fixtures({
      create(factory) {
        testDataSetup(factory, {
          puppies: {
            fieldsets: {
              isolated: [{ field: 'location', format: 'embedded' }],
              embedded: []
            }
          },
          'puppy-articles': {
            fieldsets: {
              isolated: [{ field: 'author', format: 'embedded' }],
              embedded: [{ field: 'author', format: 'embedded' }]
            }
          },
          'doggy-articles': {
            fieldsets: {
              isolated: [{ field: 'dog', format: 'embedded' }],
              embedded: []
            }
          },
          pages: {
            fieldsets: {
              isolated: [{ field: 'articles', format: "embedded" }],
            }
          }
        });
      },
    });

    scenario.setupTest(hooks);

    hooks.beforeEach(async function () {
      await this.owner.lookup('service:cardstack-codegen').refreshCode();
      this.store = this.owner.lookup('service:store');
    });

    test("it can load relationships specified in the request format's fieldset", async function (assert) {
      let dataService = this.owner.lookup('service:cardstackData');
      let homepage = await run(() => dataService.load('page', 'homepage', 'isolated'));

      let articles = homepage.get('articles').toArray().map(i => i.toJSON());
      let author = homepage.get('articles.firstObject.author');
      let error;
      try {
        homepage.get('articles.firstObject.author.location');
      } catch (e) { error = e; }
      assert.ok(error.message.match(/You looked up the 'location' relationship on a 'puppy' with id vanGogh but some of the associated records were not loaded/));

      try {
        homepage.get('articles.lastObject.dog');
      } catch (e) { error = e; }
      assert.ok(error.message.match(/You looked up the 'dog' relationship on a 'doggy-article' with id swim but some of the associated records were not loaded/));

      assert.deepEqual(homepage.toJSON(), {
        title: 'Homepage',
        selfLink: undefined,
        articles: ['bones', 'why', 'swim']
      });
      assert.deepEqual(articles, [{
        title: 'Top 10 Bones',
        body: 'I really like to chew bones, there are many good bones, but these bones are the best...',
        author: 'vanGogh',
        selfLink: undefined,
        relatedArticle: 'walk'
      }, {
        title: 'Why Doors?',
        body: "Do you understand doors? If you're like me doors are probably super confusing, let's get to the bottom of this mystery.",
        author: 'vanGogh',
        selfLink: undefined,
        relatedArticle: null
      }, {
        title: 'I Like to Swim',
        body: "Swimming is my favorite, and then I love my wet dog smell.",
        selfLink: undefined,
        dog: "ringo"
      }]);

      assert.deepEqual(author.toJSON(), {
        nickname: 'Van Gogh',
        bio: 'A cute puppy that loves to play with his squeaky snake',
        selfLink: undefined,
        location: 'nyc'
      });
    });

  });

  module('with defaultIncludes', function (hooks) {
    let scenario = new Fixtures({
      create(factory) {
        testDataSetup(factory, {
          pages: {
            defaultIncludes: [ 'articles' ],
            fieldsets: {
              isolated: [],
            }
          }
        });
      },
    });

    scenario.setupTest(hooks);

    hooks.beforeEach(async function () {
      await this.owner.lookup('service:cardstack-codegen').refreshCode();
      this.store = this.owner.lookup('service:store');
    });

    test("it loads the defaultIncludes when a format is requested that is not in the fieldset", async function(assert) {
      let dataService = this.owner.lookup('service:cardstackData');
      let homepage = await run(() => dataService.load('page', 'homepage', 'embedded'));

      let articles = homepage.get('articles').toArray().map(i => i.toJSON());
      let error;
      try {
        homepage.get('articles.firstObject.author');
      } catch (e) { error = e; }
      assert.ok(error.message.match(/You looked up the 'author' relationship on a 'puppy-article' with id bones but some of the associated records were not loaded/));

      assert.deepEqual(homepage.toJSON(), {
        title: 'Homepage',
        selfLink: undefined,
        articles: ['bones', 'why', 'swim']
      });
      assert.deepEqual(articles, [{
        title: 'Top 10 Bones',
        body: 'I really like to chew bones, there are many good bones, but these bones are the best...',
        author: 'vanGogh',
        selfLink: undefined,
        relatedArticle: 'walk'
      }, {
        title: 'Why Doors?',
        body: "Do you understand doors? If you're like me doors are probably super confusing, let's get to the bottom of this mystery.",
        author: 'vanGogh',
        selfLink: undefined,
        relatedArticle: null
      }, {
        title: 'I Like to Swim',
        body: "Swimming is my favorite, and then I love my wet dog smell.",
        selfLink: undefined,
        dog: "ringo"
      }]);
    });
  });

  module('defaultIncludes vs fieldset clash', function (hooks) {
    let scenario = new Fixtures({
      create(factory) {
        testDataSetup(factory, {
          puppies: {
            fieldsets: {
              isolated: [{ field: 'location', format: 'embedded' }],
              embedded: []
            }
          },
          'puppy-articles': {
            defaultIncludes: ['related-article'],
            fieldsets: {
              isolated: [{ field: 'author', format: 'embedded' }],
              embedded: [{ field: 'author', format: 'embedded' }]
            }
          },
          'doggy-articles': {
            fieldsets: {
              isolated: [{ field: 'dog', format: 'embedded' }],
              embedded: []
            }
          },
          pages: {
            fieldsets: {
              isolated: [{ field: 'articles', format: "embedded" }],
            }
          }
        });
      },
    });

    scenario.setupTest(hooks);

    hooks.beforeEach(async function () {
      await this.owner.lookup('service:cardstack-codegen').refreshCode();
      this.store = this.owner.lookup('service:store');
    });

    // Ideally the fieldset will control the relationship field JSONAPI via sparse fields, but for the time being we'll
    // just use the `?included=` query param to control the relationships that are included in the server response.
    // So ultimately we should also assert that the relationship field does not exist as part of this test.
    test("it does not load a relationship that is not in a request format's fieldset but is defaultIncluded", async function (assert) {
      let dataService = this.owner.lookup('service:cardstackData');
      let homepage = await run(() => dataService.load('page', 'homepage', 'isolated'));

      let articles = homepage.get('articles').toArray().map(i => i.toJSON());
      let error;
      try {
        homepage.get('articles.firstObject.relatedArticle');
      } catch (e) { error = e; }
      assert.ok(error.message.match(/You looked up the 'relatedArticle' relationship on a 'puppy-article' with id bones but some of the associated records were not loaded/));

      assert.deepEqual(homepage.toJSON(), {
        title: 'Homepage',
        selfLink: undefined,
        articles: ['bones', 'why', 'swim']
      });
      assert.deepEqual(articles, [{
        title: 'Top 10 Bones',
        body: 'I really like to chew bones, there are many good bones, but these bones are the best...',
        author: 'vanGogh',
        selfLink: undefined,
        relatedArticle: 'walk'
      }, {
        title: 'Why Doors?',
        body: "Do you understand doors? If you're like me doors are probably super confusing, let's get to the bottom of this mystery.",
        author: 'vanGogh',
        selfLink: undefined,
        relatedArticle: null
      }, {
        title: 'I Like to Swim',
        body: "Swimming is my favorite, and then I love my wet dog smell.",
        selfLink: undefined,
        dog: "ringo"
      }]);
    });

  });

  // Ember runloop.
  function run(fn) {
    return RSVP.resolve().then(() => fn.apply(this, arguments));
  }
});
