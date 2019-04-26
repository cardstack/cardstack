const JSONAPIFactory = require('../../../tests/stub-searcher/node_modules/@cardstack/test-support/jsonapi-factory');
const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('../../../tests/stub-searcher/node_modules/@cardstack/test-support/env');
const Session = require('@cardstack/plugin-utils/session');
const everyone = { type: 'groups', id: 'everyone' };

describe('hub/searchers/auth', function() {
  let env, searchers, sessions;

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

    factory.addResource('authors', 'quint').withAttributes({
      name: 'Quint Faulkner'
    });

    factory.addResource('posts', '1').withAttributes({
      title: 'First Post',
      subtitle: 'It is the best'
    }).withRelated('author', factory.addResource('authors', 'arthur').withAttributes({
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
    sessions = env.lookup('hub:sessions');
  }

  afterEach(async function() {
    if (env) {
      await destroyDefaultEnvironment(env);
    }
  });

  it("returns 404 when user has no grant", async function() {
    await setup();
    try {
      await searchers.get(Session.EVERYONE, 'local-hub', 'posts', '1');
    } catch (err) {
      expect(err).has.property('status', 404);
      return;
    }
    throw new Error("should not get here");
  });

  it("returns resource when user has a grant with unrestricted type", async function() {
    await setup(factory => {
      factory.addResource('grants')
        .withAttributes({ mayReadResource: true, mayReadFields: true })
        .withRelated('who', [everyone]);
    });
    let doc = await searchers.get(Session.EVERYONE, 'local-hub', 'posts', '1');
    expect(doc).has.deep.property('data.attributes.title', 'First Post');
  });

  it("returns resource when user has a grant with matching type", async function() {
    await setup(factory => {
      factory.addResource('grants')
        .withAttributes({ mayReadResource: true, mayReadFields: true })
        .withRelated('who', [everyone])
        .withRelated('types', [{ type: 'content-types', id: 'posts' }]);
    });
    let doc = await searchers.get(Session.EVERYONE, 'local-hub', 'posts', '1');
    expect(doc).has.deep.property('data.attributes.title', 'First Post');
  });

  it("returns 404 when user has a grant with a different type", async function() {
    await setup(factory => {
      factory.addResource('grants')
        .withAttributes({ mayReadResource: true })
        .withRelated('who', [everyone])
        .withRelated('types', [{ type: 'content-types', id: 'fields' }]);
    });
    try {
      await searchers.get(Session.EVERYONE, 'local-hub', 'posts', '1');
    } catch (err) {
      expect(err).has.property('status', 404);
      return;
    }
    throw new Error("should not get here");
  });

  it("filters unauthorized resources from searches", async function() {
    await setup();
    let response = await searchers.search(Session.EVERYONE, { filter: { type: 'posts' } });
    expect(response.data).has.length(0);
  });

  it("includes authorized resources in searches", async function() {
    await setup(factory => {
      factory.addResource('grants')
        .withAttributes({ mayReadResource: true })
        .withRelated('who', [everyone])
        .withRelated('types', [{ type: 'content-types', id: 'posts' }]);
    });
    let response = await searchers.search(Session.EVERYONE, { filter: { type: 'posts' } });
    expect(response.data).has.length(1);
  });

  it("removes unauthorized attributes from individual get", async function() {
    await setup(factory => {
      factory.addResource('grants')
        .withAttributes({ mayReadResource: true, mayReadFields: true })
        .withRelated('who', [everyone])
        .withRelated('fields', [{ type: 'fields', id: 'title' }]);
    });
    let doc = await searchers.get(Session.EVERYONE, 'local-hub', 'posts', '1');
    expect(doc).not.has.deep.property('data.attributes.subtitle');
  });

  it("keeps authorized attributes in individual get", async function() {
    await setup(factory => {
      factory.addResource('grants')
        .withAttributes({ mayReadResource: true, mayReadFields: true })
        .withRelated('who', [everyone])
        .withRelated('fields', [{ type: 'fields', id: 'title' }]);
    });
    let doc = await searchers.get(Session.EVERYONE, 'local-hub', 'posts', '1');
    expect(doc).has.deep.property('data.attributes.title');
  });

  it("removes unauthorized attributes from collection search", async function() {
    await setup(factory => {
      factory.addResource('grants')
        .withAttributes({ mayReadResource: true, mayReadFields: true })
        .withRelated('who', [everyone])
        .withRelated('fields', [{ type: 'fields', id: 'title' }]);
    });
    let doc = await searchers.search(Session.EVERYONE, { filter: { type: 'posts' } });
    expect(doc.data[0]).not.has.deep.property('attributes.subtitle');
  });

  it("keeps authorized attributes in collection search", async function() {
    await setup(factory => {
      factory.addResource('grants')
        .withAttributes({ mayReadResource: true, mayReadFields: true })
        .withRelated('who', [everyone])
        .withRelated('fields', [{ type: 'fields', id: 'title' }]);
    });
    let doc = await searchers.search(Session.EVERYONE, { filter: { type: 'posts' } });
    expect(doc.data[0]).has.deep.property('attributes.title');
  });

  it("removes unauthorized relationships", async function() {
    await setup(factory => {
      factory.addResource('grants')
        .withAttributes({ mayReadResource: true, mayReadFields: true })
        .withRelated('who', [everyone])
        .withRelated('fields', [{ type: 'fields', id: 'title' }]);
    });
    let doc = await searchers.get(Session.EVERYONE, 'local-hub', 'posts', '1');
    expect(doc).not.has.deep.property('data.relationships.author');
  });

  it("keeps authorized relationships", async function() {
    await setup(factory => {
      factory.addResource('grants')
        .withAttributes({ mayReadResource: true, mayReadFields: true })
        .withRelated('who', [everyone])
        .withRelated('fields', [
          { type: 'fields', id: 'title' },
          { type: 'fields', id: 'author' }
        ]);
    });
    let doc = await searchers.get(Session.EVERYONE, 'local-hub', 'posts', '1');
    expect(doc).has.deep.property('data.relationships.author');
  });

  it("matches attribute-dependent grant", async function() {
    await setup(factory => {
      factory.addResource('grants')
        .withAttributes({ mayReadResource: true, mayReadFields: true })
        .withRelated('who', [{ type: 'fields', id: 'author' }]);
    });
    let doc = await searchers.search(sessions.create('authors', 'arthur'), { filter: { type: 'posts' } });
    expect(doc.data).has.length(1);
    expect(doc.data[0]).has.deep.property('attributes.title', 'First Post');
    expect(doc.meta).has.deep.property('page.total', 1);
  });

  it("doesn't matches inapplicable attribute-dependent grant", async function() {
    await setup(factory => {
      factory.addResource('grants')
        .withAttributes({ mayReadResource: true, mayReadFields: true })
        .withRelated('who', [{ type: 'fields', id: 'author' }]);
    });
    let doc = await searchers.search(sessions.create('authors', 'other'), { filter: { type: 'posts' } });
    expect(doc.data).has.length(0);
  });

  it("matches a group grant", async function() {
    await setup(factory => {
      factory.addResource('grants')
        .withAttributes({ mayReadResource: true, mayReadFields: true })
        .withRelated('who', [{ type: 'groups', id: 'cool-kids' }]);
      factory.addResource('groups', 'cool-kids')
        .withAttributes({
          searchQuery: { filter: { type: { exact: 'authors' }, name: { exact: 'Arthur Faulkner' } } }
        });
    });
    let doc = await searchers.search(sessions.create('authors', 'arthur'), { filter: { type: 'posts' } });
    expect(doc.data).has.length(1);
    expect(doc.data[0]).has.deep.property('attributes.title', 'First Post');
    expect(doc.meta).has.deep.property('page.total', 1);
  });

  it("does not match a group grant", async function() {
    await setup(factory => {
      factory.addResource('grants')
        .withAttributes({ mayReadResource: true, mayReadFields: true })
        .withRelated('who', [{ type: 'groups', id: 'cool-kids' }]);
      factory.addResource('groups', 'cool-kids')
        .withAttributes({
          searchQuery: { filter: { type: { exact: 'authors' }, name: { exact: 'Somebody Else' } } }
        });
    });
    let doc = await searchers.search(sessions.create('authors', 'arthur'), { filter: { type: 'posts' } });
    expect(doc.data).has.length(0);
  });

  it("matches a multi-group grant", async function() {
    await setup(factory => {
      factory.addResource('grants')
        .withAttributes({ mayReadResource: true, mayReadFields: true })
        .withRelated('who', [{ type: 'groups', id: 'cool-kids' }, { type: 'groups', id: 'famous-people' }]);
      factory.addResource('groups', 'cool-kids')
        .withAttributes({
          searchQuery: { filter: { type: { exact: 'authors' }, name: { exact: 'Arthur Faulkner' } } }
        });
      factory.addResource('groups', 'famous-people')
        .withAttributes({
          searchQuery: { filter: { type: { exact: 'authors' }, name: { exact: 'Arthur Faulkner' } } }
        });
    });
    let doc = await searchers.search(sessions.create('authors', 'arthur'), { filter: { type: 'posts' } });
    expect(doc.data).has.length(1);
    expect(doc.data[0]).has.deep.property('attributes.title', 'First Post');
    expect(doc.meta).has.deep.property('page.total', 1);
  });

  it("does not matches a multi-group grant without all the groups", async function() {
    await setup(factory => {
      factory.addResource('grants')
        .withAttributes({ mayReadResource: true, mayReadFields: true })
        .withRelated('who', [{ type: 'groups', id: 'cool-kids' }, { type: 'groups', id: 'famous-people' }]);
      factory.addResource('groups', 'cool-kids')
        .withAttributes({
          searchQuery: { filter: { type: { exact: 'authors' }, name: { exact: 'Somebody Else' } } }
        });
      factory.addResource('groups', 'famous-people')
        .withAttributes({
          searchQuery: { filter: { type: { exact: 'authors' }, name: { exact: 'Arthur Faulkner' } } }
        });
    });
    let doc = await searchers.search(sessions.create('authors', 'arthur'), { filter: { type: 'posts' } });
    expect(doc.data).has.length(0);
  });

  it("matches a combined group and field-dependent user grant", async function() {
    await setup(factory => {
      factory.addResource('grants')
        .withAttributes({ mayReadResource: true, mayReadFields: true })
        .withRelated('who', [{ type: 'groups', id: 'cool-kids' }, { type: 'fields', id: 'author' }]);
      factory.addResource('groups', 'cool-kids')
        .withAttributes({
          searchQuery: { filter: { type: { exact: 'authors' }, name: { exact: 'Arthur Faulkner' } } }
        });
    });
    let doc = await searchers.search(sessions.create('authors', 'arthur'), { filter: { type: 'posts' } });
    expect(doc.data).has.length(1);
    expect(doc.data[0]).has.deep.property('attributes.title', 'First Post');
    expect(doc.meta).has.deep.property('page.total', 1);
  });

  it("rejects a combined group and field-dependent user grant when the group is missing", async function() {
    await setup(factory => {
      factory.addResource('grants')
        .withAttributes({ mayReadResource: true, mayReadFields: true })
        .withRelated('who', [{ type: 'groups', id: 'cool-kids' }, { type: 'fields', id: 'author' }]);
      factory.addResource('groups', 'cool-kids')
        .withAttributes({
          searchQuery: { filter: { type: { exact: 'authors' }, name: { exact: 'other' } } }
        });
    });
    let doc = await searchers.search(sessions.create('authors', 'arthur'), { filter: { type: 'posts' } });
    expect(doc.data).has.length(0);
  });

  it("rejects a combined group and field-dependent user grant when the user does not match", async function() {
    await setup(factory => {
      factory.addResource('grants')
        .withAttributes({ mayReadResource: true, mayReadFields: true })
        .withRelated('who', [{ type: 'groups', id: 'cool-kids' }, { type: 'fields', id: 'author' }]);
      factory.addResource('groups', 'cool-kids')
        .withAttributes({
          searchQuery: { filter: { type: { exact: 'authors' }, name: { exact: 'Quint Faulkner' } } }
        });
    });
    let doc = await searchers.search(sessions.create('authors', 'quint'), { filter: { type: 'posts' } });
    expect(doc.data).has.length(0);
  });

  it("rejects a combined group and field-dependent user grant when the group does not match", async function() {
    await setup(factory => {
      factory.addResource('grants')
        .withAttributes({ mayReadResource: true, mayReadFields: true })
        .withRelated('who', [{ type: 'groups', id: 'cool-kids' }, { type: 'fields', id: 'author' }]);
      factory.addResource('groups', 'cool-kids')
        .withAttributes({
          searchQuery: { filter: { type: { exact: 'authors' }, name: { exact: 'Quint Faulkner' } } }
        });
    });
    let doc = await searchers.search(sessions.create('authors', 'arthur'), { filter: { type: 'posts' } });
    expect(doc.data).has.length(0);
  });

  it("stops matching a group grant when the user is deleted", async function() {
    await setup(factory => {
      factory.addResource('grants')
        .withAttributes({ mayReadResource: true, mayReadFields: true })
        .withRelated('who', [{ type: 'groups', id: 'cool-kids' }]);
      factory.addResource('groups', 'cool-kids')
        .withAttributes({
          searchQuery: { filter: { type: { exact: 'authors' }, name: { exact: 'Arthur Faulkner' } } }
        });
    });

    let session = sessions.create('authors', 'arthur');
    let user = await searchers.get(Session.INTERNAL_PRIVILEGED, 'local-hub', 'authors', 'arthur');
    await env.lookup('hub:writers').delete(Session.INTERNAL_PRIVILEGED, user.data.meta.version, user.data.type, user.data.id);
    await env.lookup('hub:indexers').update({ forceRefresh: true });
    let doc = await searchers.search(session, { filter: { type: 'posts' } });
    expect(doc.data).has.length(0);
  });

  it("stops matching a group grant when the user is modified out of the group", async function() {
    await setup(factory => {
      factory.addResource('grants')
        .withAttributes({ mayReadResource: true, mayReadFields: true })
        .withRelated('who', [{ type: 'groups', id: 'cool-kids' }]);
      factory.addResource('groups', 'cool-kids')
        .withAttributes({
          searchQuery: { filter: { type: { exact: 'authors' }, name: { exact: 'Arthur Faulkner' } } }
        });
    });

    let session = sessions.create('authors', 'arthur');
    let user = await searchers.get(Session.INTERNAL_PRIVILEGED, 'local-hub', 'authors', 'arthur');
    user.data.attributes.name = 'Updated name';
    await env.lookup('hub:writers').update(Session.INTERNAL_PRIVILEGED, user.data.type, user.data.id, user);
    await env.lookup('hub:indexers').update({ forceRefresh: true });
    let doc = await searchers.search(session, { filter: { type: 'posts' } });
    expect(doc.data).has.length(0);
  });

  it("starts matching a group grant when the user is modified into the group", async function() {
    await setup(factory => {
      factory.addResource('grants')
        .withAttributes({ mayReadResource: true, mayReadFields: true })
        .withRelated('who', [{ type: 'groups', id: 'cool-kids' }]);
      factory.addResource('groups', 'cool-kids')
        .withAttributes({
          searchQuery: { filter: { type: { exact: 'authors' }, name: { exact: 'Updated name' } } }
        });
    });

    let session = sessions.create('authors', 'arthur');
    let user = await searchers.get(Session.INTERNAL_PRIVILEGED, 'local-hub', 'authors', 'arthur');
    user.data.attributes.name = 'Updated name';
    await env.lookup('hub:writers').update(Session.INTERNAL_PRIVILEGED, user.data.type, user.data.id, user);
    await env.lookup('hub:indexers').update({ forceRefresh: true });
    let doc = await searchers.search(session, { filter: { type: 'posts' } });
    expect(doc.data).has.length(1);
    expect(doc.data[0]).has.deep.property('attributes.title', 'First Post');
    expect(doc.meta).has.deep.property('page.total', 1);
  });


  it("reacts when a grant is created", async function() {
    await setup(factory => {
      factory.addResource('groups', 'cool-kids')
        .withAttributes({
          searchQuery: { filter: { type: { exact: 'authors' }, name: { exact: 'Arthur Faulkner' } } }
        });
    });

    let factory = new JSONAPIFactory();

    factory.addResource('grants')
      .withAttributes({ mayReadResource: true, mayReadFields: true })
      .withRelated('who', [{ type: 'groups', id: 'cool-kids' }]);

    let writers = env.lookup('hub:writers');
    for (let model of factory.getModels()) {
      let { type } = model;
      await writers.create(Session.INTERNAL_PRIVILEGED, type, { data: model });
    }

    let doc = await searchers.search(sessions.create('authors', 'arthur'), { filter: { type: 'posts' } });
    expect(doc.data).has.length(1);
    expect(doc.data[0]).has.deep.property('attributes.title', 'First Post');
    expect(doc.meta).has.deep.property('page.total', 1);
  });

  it("reacts when a grant is updated", async function() {
    await setup(factory => {
      factory.addResource('groups', 'not-cool-kids')
        .withAttributes({
          searchQuery: { filter: { type: { exact: 'authors' }, name: { exact: 'Hassan Abdel-Rahman' } } }
        });
      factory.addResource('groups', 'cool-kids')
        .withAttributes({
          searchQuery: { filter: { type: { exact: 'authors' }, name: { exact: 'Arthur Faulkner' } } }
        });
      factory.addResource('grants', 'test-grant')
        .withAttributes({ mayReadResource: true, mayReadFields: true })
        .withRelated('who', [{ type: 'groups', id: 'not-cool-kids' }]);
    });

    let writers = env.lookup('hub:writers');
    let searchers = env.lookup('hub:searchers');
    let grant = await searchers.get(Session.INTERNAL_PRIVILEGED, 'local-hub', 'grants', 'test-grant');

    grant.data.relationships.who.data = [{ id: 'cool-kids', type: 'groups' }];
    await writers.update(Session.INTERNAL_PRIVILEGED, 'grants', 'test-grant', grant);

    let doc = await searchers.search(sessions.create('authors', 'arthur'), { filter: { type: 'posts' } });
    expect(doc.data).has.length(1);
    expect(doc.data[0]).has.deep.property('attributes.title', 'First Post');
    expect(doc.meta).has.deep.property('page.total', 1);
  });

  it("reacts when a grant is deleted", async function() {
    await setup(factory => {
      factory.addResource('groups', 'cool-kids')
        .withAttributes({
          searchQuery: { filter: { type: { exact: 'authors' }, name: { exact: 'Arthur Faulkner' } } }
        });
      factory.addResource('grants', 'test-grant')
        .withAttributes({ mayReadResource: true, mayReadFields: true })
        .withRelated('who', [{ type: 'groups', id: 'not-cool-kids' }]);
    });

    let writers = env.lookup('hub:writers');
    let searchers = env.lookup('hub:searchers');
    let grant = await searchers.get(Session.INTERNAL_PRIVILEGED, 'local-hub', 'grants', 'test-grant');

    await writers.delete(Session.INTERNAL_PRIVILEGED, grant.data.meta.version, 'grants', 'test-grant');

    let doc = await searchers.search(sessions.create('authors', 'arthur'), { filter: { type: 'posts' } });
    expect(doc.data).has.length(0);
  });
});
