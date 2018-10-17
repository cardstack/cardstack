const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('@cardstack/test-support/env');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

describe('routing/searcher', function() {
  let env, searchers;

  async function setup() {
    let factory = new JSONAPIFactory();

    factory.addResource('data-sources')
      .withAttributes({
        'source-type': '@cardstack/routing',
      });

    factory.addResource('content-types', 'pages')
      .withAttributes({
        fieldsets: {
          isolated: [{ field: 'posts', format: 'embedded' }]
        }
      })
      .withRelated('fields', [
        factory.addResource('fields', 'title').withAttributes({
          fieldType: '@cardstack/core-types::string'
        }),
        factory.addResource('fields', 'posts').withAttributes({
          fieldType: '@cardstack/core-types::has-many'
        }),
      ]);
    factory.addResource('content-types', 'posts')
      .withRelated('fields', [
        factory.addResource('fields', 'body').withAttributes({
          fieldType: '@cardstack/core-types::string'
        }),
        factory.addResource('fields', 'author').withAttributes({
          fieldType: '@cardstack/core-types::belongs-to'
        }),
      ]);
    factory.addResource('content-types', 'authors')
      .withRelated('fields', [
        factory.addResource('fields', 'name').withAttributes({
          fieldType: '@cardstack/core-types::string'
        }),
      ]);

    let author = factory.addResource('authors', 'vanGogh')
      .withAttributes({
        name: 'Van Gogh'
      });
    factory.addResource('pages', 'puppies')
      .withAttributes({
        title: 'The Puppy Blog'
      })
      .withRelated('posts', [
        factory.addResource('posts', 'rainy-day').withAttributes({
          body: "It's so rainy today and I wanna go outside but I don't want to get wet."
        }).withRelated('author', author),
        factory.addResource('posts', 'tummy-rub').withAttributes({
          body: "Rub my tummy now or I'll whine all night."
        }).withRelated('author', author),
        factory.addResource('posts', 'tug-of-war').withAttributes({
          body: "I'm the best at tug of war, you can't steal my toys from me."
        }).withRelated('author', author),
      ]);

    env = await createDefaultEnvironment(`${__dirname}/test-project`, factory.getModels());
    searchers = env.lookup('hub:searchers');
  }

  async function teardown() {
    await destroyDefaultEnvironment(env);
  }

  beforeEach(setup);
  afterEach(teardown);

  // This is a very simplistic scenario that will eventually be
  // refactored to leverage a function to derive the related card
  it('returns a space whose related card is the space id', async function() {
    let { data:space } = await searchers.get(env.session, 'master', 'spaces', 'pages/puppies');
    expect(space).has.property('id', 'pages/puppies');
    expect(space).has.deep.property('relationships.primary-card.data.id', 'puppies');
    expect(space).has.deep.property('relationships.primary-card.data.type', 'pages');
  });

  it('contains the url segment that designates the space', async function() {
    let { data:space } = await searchers.get(env.session, 'master', 'spaces', 'pages/puppies');
    expect(space).has.deep.property('attributes.url-segment', '/pages/puppies');
  });

  it('includes the graph of relationships based on the primary card`s `isolated` format', async function() {
    let { included } = await searchers.get(env.session, 'master', 'spaces', 'pages/puppies');
    let includedIds = included.map(i => `${i.type}/${i.id}`);
    expect(includedIds).to.have.members([
      'pages/puppies',
      'posts/rainy-day',
      'posts/tummy-rub',
      'posts/tug-of-war'
    ]);
  });

});