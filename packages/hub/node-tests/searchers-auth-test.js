const JSONAPIFactory = require('../../../tests/stub-searcher/node_modules/@cardstack/test-support/jsonapi-factory');
const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('../../../tests/stub-searcher/node_modules/@cardstack/test-support/env');
const Session = require('@cardstack/plugin-utils/session');
const everyone = { type: 'groups', id: 'everyone' };

describe('hub/searchers/auth', function() {
  let env, searchers;

  async function setup(fn) {
    let factory = new JSONAPIFactory();

    factory.addResource('content-types', 'posts')
      .withAttributes({
        defaultIncludes: ['tags']
      })
      .withRelated('fields', [
        factory.addResource('fields', 'title').withAttributes({
          fieldType: '@cardstack/core-types::string'
        }),
        factory.addResource('fields', 'subtitle').withAttributes({
          fieldType: '@cardstack/core-types::string'
        }),
        factory.addResource('fields', 'author').withAttributes({
          fieldType: '@cardstack/core-types::belongs-to'
        }).withRelated('related-types', [
          factory.addResource('content-types', 'authors').withRelated('fields', [
            factory.addResource('fields', 'name').withAttributes({
              fieldType: '@cardstack/core-types::string'
            })
          ])
        ]),
        factory.addResource('fields', 'tags').withAttributes({
          fieldType: '@cardstack/core-types::has-many'
        }).withRelated('related-types', [
          factory.addResource('content-types', 'tags')
        ])
      ]);


    factory.addResource('posts', '1').withAttributes({
      title: 'First Post',
      subtitle: 'It is the best'
    }).withRelated('author', factory.addResource('authors').withAttributes({
      name: 'Arthur Faulkner'
    })).withRelated('tags', [
      factory.addResource('tags', 'one'),
      factory.addResource('tags', 'two')
    ]);

    if (fn) {
      await fn(factory);
    }

    env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-searcher`, factory.getModels());
    searchers = env.lookup('hub:searchers');
  }

  afterEach(async function() {
    if (env) {
      await destroyDefaultEnvironment(env);
    }
  });

  it("returns 404 when user has no grant", async function() {
    await setup();
    try {
      await searchers.get(Session.EVERYONE, 'master', 'posts', '1');
    } catch (err) {
      expect(err).has.property('status', 404);
      return;
    }
    throw new Error("should not get here");
  });

  it("returns resource when user has a grant with unrestricted type", async function() {
    await setup(factory => {
      factory.addResource('grants')
        .withAttributes({ mayReadResource: true })
        .withRelated('who', everyone);
    });
    let doc = await searchers.get(Session.EVERYONE, 'master', 'posts', '1');
    expect(doc).has.deep.property('data.attributes.title', 'First Post');
  });

  it("returns resource when user has a grant with matching type", async function() {
    await setup(factory => {
      factory.addResource('grants')
        .withAttributes({ mayReadResource: true })
        .withRelated('who', everyone)
        .withRelated('types', [{ type: 'content-types', id: 'posts' }]);
    });
    let doc = await searchers.get(Session.EVERYONE, 'master', 'posts', '1');
    expect(doc).has.deep.property('data.attributes.title', 'First Post');
  });

  it("returns 404 when user has a grant with a different type", async function() {
    await setup(factory => {
      factory.addResource('grants')
        .withAttributes({ mayReadResource: true })
        .withRelated('who', everyone)
        .withRelated('types', [{ type: 'content-types', id: 'fields' }]);
    });
    try {
      await searchers.get(Session.EVERYONE, 'master', 'posts', '1');
    } catch (err) {
      expect(err).has.property('status', 404);
      return;
    }
    throw new Error("should not get here");
  });

  it("filters unauthorized resources from searches", async function() {
    await setup();
    let response = await searchers.search(Session.EVERYONE, 'master', { filter: { type: 'posts' } });
    expect(response.data).has.length(0);
  });

  it("includes authorized resources in searches", async function() {
    await setup(factory => {
      factory.addResource('grants')
        .withAttributes({ mayReadResource: true })
        .withRelated('who', everyone)
        .withRelated('types', [{ type: 'content-types', id: 'posts' }]);
    });
    let response = await searchers.search(Session.EVERYONE, 'master', { filter: { type: 'posts' } });
    expect(response.data).has.length(1);
  });

  it.skip("removes unauthorized attributes from individual get", async function() {
    await setup(factory => {
      factory.addResource('grants')
        .withAttributes({ mayReadResource: true, mayReadFields: true })
        .withRelated('who', everyone)
        .withRelated('fields', ['title']);
    });
    let doc = await searchers.get(Session.EVERYONE, 'master', 'posts', '1');
    expect(doc).not.has.deep.property('data.attributes.subtitle');
  });

  it("keeps authorized attributes in individual get", async function() {
    await setup(factory => {
      factory.addResource('grants')
        .withAttributes({ mayReadResource: true, mayReadFields: true })
        .withRelated('who', everyone)
        .withRelated('fields', ['title']);
    });
    let doc = await searchers.get(Session.EVERYONE, 'master', 'posts', '1');
    expect(doc).has.deep.property('data.attributes.title');
  });

  it("removes unauthorized attributes from collection search");
  it("keeps authorized attributes in collection search");

  it("removes unauthorized relationships");
  it("keeps authorized relationships");
  it("removes unauthorized includes");
  it("keeps authorized includes");
  it("removes unauthorized attributes from includes");
  it("reacts when a grant is created");
  it("reacts when a grant is updated");
  it("reacts when a grant is deleted");
});
