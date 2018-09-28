import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';
import { get } from 'lodash';
import '@ember/test-helpers';
import Fixtures from '@cardstack/test-support/fixtures';
import RSVP from 'rsvp';

function testDataSetup(factory, opts) {
  let locations = factory.addResource('content-types', 'locations')
    .withRelated('fields', [
      factory.addResource('fields', 'city').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
    ]);

    if (get(opts, 'locations.fieldsets')) {
      locations.withAttributes({ fieldsets: opts.locations.fieldsets });
    }
    if (get(opts, 'locations.defaultIncludes')) {
      locations.withAttributes({ defaultIncludes: opts.locations.defaultIncludes });
    }

  let puppies = factory.addResource('content-types', 'puppies')
    .withRelated('fields', [
      factory.addResource('fields', 'name').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
      factory.addResource('fields', 'bio').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
      factory.addResource('fields', 'location').withAttributes({
        fieldType: '@cardstack/core-types::belongs-to'
      }).withRelated('related-types', [locations])
    ]);

    if (get(opts, 'puppies.fieldsets')) {
      puppies.withAttributes({ fieldsets: opts.puppies.fieldsets });
    }
    if (get(opts, 'puppies.defaultIncludes')) {
      puppies.withAttributes({ defaultIncludes: opts.puppies.defaultIncludes });
    }

  let doggies = factory.addResource('content-types', 'doggies')
    .withRelated('fields', [
      factory.addResource('fields', 'name').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
    ]);

    if (get(opts, 'doggies.fieldsets')) {
      doggies.withAttributes({ fieldsets: opts.doggies.fieldsets });
    }
    if (get(opts, 'doggies.defaultIncludes')) {
      doggies.withAttributes({ defaultIncludes: opts.doggies.defaultIncludes });
    }

  let puppyArticles = factory.addResource('content-types', 'puppy-articles')
    .withRelated('fields', [
      factory.addResource('fields', 'title').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
      factory.addResource('fields', 'body').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
      factory.addResource('fields', 'author').withAttributes({
        fieldType: '@cardstack/core-types::belongs-to'
      }).withRelated('related-types', [puppies]),
      factory.addResource('fields', 'related-article').withAttributes({
        fieldType: '@cardstack/core-types::belongs-to'
      })
    ]);

    if (get(opts, 'puppy-articles.fieldsets')) {
      puppyArticles.withAttributes({ fieldsets: opts['puppy-articles'].fieldsets });
    }
    if (get(opts, 'puppy-articles.defaultIncludes')) {
      puppyArticles.withAttributes({ defaultIncludes: opts['puppy-articles'].defaultIncludes });
    }

  let doggyArticles = factory.addResource('content-types', 'doggy-articles')
    .withRelated('fields', [
      factory.addResource('fields', 'title').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
      factory.addResource('fields', 'body').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
      factory.addResource('fields', 'dog').withAttributes({
        fieldType: '@cardstack/core-types::belongs-to'
      }).withRelated('related-types', [doggies])
    ]);

    if (get(opts, 'doggy-articles.fieldsets')) {
      doggyArticles.withAttributes({ fieldsets: opts['doggy-articles'].fieldsets });
    }
    if (get(opts, 'doggy-articles.defaultIncludes')) {
      doggyArticles.withAttributes({ defaultIncludes: opts['doggy-articles'].defaultIncludes });
    }

  let pages = factory.addResource('content-types', 'pages')
    .withRelated('fields', [
      factory.addResource('fields', 'title').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
      factory.addResource('fields', 'articles').withAttributes({
        fieldType: '@cardstack/core-types::has-many'
      }) // this relationship is polymorphic, hence no `related-types`
    ]);

    if (get(opts, 'pages')) {
      pages.withAttributes({ fieldsets: opts.pages.fieldsets });
    }
    if (get(opts, 'pages.defaultIncludes')) {
      pages.withAttributes({ defaultIncludes: opts.pages.defaultIncludes });
    }

  let nyc = factory.addResource('locations', 'nyc')
    .withAttributes({
      city: 'New York City',
    });

  let vanGogh = factory.addResource('puppies', 'vanGogh')
    .withAttributes({
      name: 'Van Gogh',
      bio: 'A cute puppy that loves to play with his squeaky snake',
    }).withRelated('location', nyc);

  let ringo = factory.addResource('doggies', 'ringo')
    .withAttributes({
      name: 'Ringo',
    });

  let article1 = factory.addResource('puppy-articles', 'bones')
    .withAttributes({
      title: 'Top 10 Bones',
      body: 'I really like to chew bones, there are many good bones, but these bones are the best...'
    }).withRelated('author', vanGogh)
      .withRelated('related-article', factory.addResource('puppy-articles', 'walk').withAttributes({
        title: 'Take Me For a Walk',
        body: "I don't care if it's raining!"
      }));

  let article2 = factory.addResource('puppy-articles', 'why')
    .withAttributes({
      title: 'Why Doors?',
      body: "Do you understand doors? If you're like me doors are probably super confusing, let's get to the bottom of this mystery."
    }).withRelated('author', vanGogh)

  let article3 = factory.addResource('doggy-articles', 'swim')
    .withAttributes({
      title: 'I Like to Swim',
      body: "Swimming is my favorite, and then I love my wet dog smell."
    }).withRelated('dog', ringo);

  factory.addResource('pages', 'homepage')
    .withAttributes({
      title: 'Homepage',
    }).withRelated('articles', [article1, article2, article3]);

}

module('Integration | @cardstack/data service', function (hooks) {
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
      await run(() => dataService.load('page', 'homepage', 'isolated'));

      let homepage = this.store.peekRecord('page', 'homepage');
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
        articles: ['bones', 'why', 'swim']
      });
      assert.deepEqual(articles, [{
        title: 'Top 10 Bones',
        body: 'I really like to chew bones, there are many good bones, but these bones are the best...',
        author: 'vanGogh',
        relatedArticle: 'walk'
      }, {
        title: 'Why Doors?',
        body: "Do you understand doors? If you're like me doors are probably super confusing, let's get to the bottom of this mystery.",
        author: 'vanGogh',
        relatedArticle: null
      }, {
        title: 'I Like to Swim',
        body: "Swimming is my favorite, and then I love my wet dog smell.",
        dog: "ringo"
      }]);

      assert.deepEqual(author.toJSON(), {
        name: 'Van Gogh',
        bio: 'A cute puppy that loves to play with his squeaky snake',
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
      await run(() => dataService.load('page', 'homepage', 'embedded'));

      let homepage = this.store.peekRecord('page', 'homepage');
      let articles = homepage.get('articles').toArray().map(i => i.toJSON());
      let error;
      try {
        homepage.get('articles.firstObject.author');
      } catch (e) { error = e; }
      assert.ok(error.message.match(/You looked up the 'author' relationship on a 'puppy-article' with id bones but some of the associated records were not loaded/));

      assert.deepEqual(homepage.toJSON(), {
        title: 'Homepage',
        articles: ['bones', 'why', 'swim']
      });
      assert.deepEqual(articles, [{
        title: 'Top 10 Bones',
        body: 'I really like to chew bones, there are many good bones, but these bones are the best...',
        author: 'vanGogh',
        relatedArticle: 'walk'
      }, {
        title: 'Why Doors?',
        body: "Do you understand doors? If you're like me doors are probably super confusing, let's get to the bottom of this mystery.",
        author: 'vanGogh',
        relatedArticle: null
      }, {
        title: 'I Like to Swim',
        body: "Swimming is my favorite, and then I love my wet dog smell.",
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
      await run(() => dataService.load('page', 'homepage', 'isolated'));

      let homepage = this.store.peekRecord('page', 'homepage');
      let articles = homepage.get('articles').toArray().map(i => i.toJSON());
      let error;
      try {
        homepage.get('articles.firstObject.relatedArticle');
      } catch (e) { error = e; }
      assert.ok(error.message.match(/You looked up the 'relatedArticle' relationship on a 'puppy-article' with id bones but some of the associated records were not loaded/));

      assert.deepEqual(homepage.toJSON(), {
        title: 'Homepage',
        articles: ['bones', 'why', 'swim']
      });
      assert.deepEqual(articles, [{
        title: 'Top 10 Bones',
        body: 'I really like to chew bones, there are many good bones, but these bones are the best...',
        author: 'vanGogh',
        relatedArticle: 'walk'
      }, {
        title: 'Why Doors?',
        body: "Do you understand doors? If you're like me doors are probably super confusing, let's get to the bottom of this mystery.",
        author: 'vanGogh',
        relatedArticle: null
      }, {
        title: 'I Like to Swim',
        body: "Swimming is my favorite, and then I love my wet dog smell.",
        dog: "ringo"
      }]);
    });

  });

  // Ember runloop.
  function run(fn) {
    return RSVP.resolve().then(() => fn.apply(this, arguments));
  }
});
