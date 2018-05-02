const Session = require('@cardstack/plugin-utils/session');
const JSONAPIFactory = require('../../../tests/stub-project/node_modules/@cardstack/test-support/jsonapi-factory');
const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('../../../tests/stub-searcher/node_modules/@cardstack/test-support/env');

describe('schema/auth/read', function() {

  let env, baseSchema, searchers;

  async function find(type, id) {
    return searchers.get(Session.INTERNAL_PRIVILEGED, 'master', type, id);
  }

  async function findAll(type) {
    return searchers.search(Session.INTERNAL_PRIVILEGED, 'master', { filter: { type } });
  }


  async function withGrants(fn) {
    let factory = new JSONAPIFactory();

    fn(factory);

    for (let model of factory.getModels()) {
      if (model.type === 'grants') {
        let resource = factory.getResource('grants', model.id);
        resource.withRelated('who', [{ type: 'test-users', id: 'session-with-grants' }]);
      }
    }

    let session = new Session({ type: 'test-users', id: 'session-with-grants' });
    let schema = await baseSchema.applyChanges(factory.getModels().map(model => ({ type: model.type, id: model.id, document: model })));
    return { schema, session };
  }

  before(async function() {
    let factory = new JSONAPIFactory();

    factory.addResource('content-types', 'posts')
      .withAttributes({
        defaultIncludes: ['tags', 'author', 'author.flavor']
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
            }),
            factory.addResource('fields', 'flavor').withAttributes({
              fieldType: '@cardstack/core-types::belongs-to'
            }).withRelated('related-types', [
              factory.addResource('content-types', 'flavors')
            ])
          ])
        ]),
        factory.addResource('fields', 'tags').withAttributes({
          fieldType: '@cardstack/core-types::has-many'
        }).withRelated('related-types', [
          factory.addResource('content-types', 'tags')
        ]),
        factory.addResource('fields', 'collaborators').withAttributes({
          fieldType: '@cardstack/core-types::has-many'
        }).withRelated('related-types', [ factory.getResource('content-types', 'authors') ])
      ]);


    factory.addResource('posts', '1').withAttributes({
      title: 'First Post',
      subtitle: 'It is the best'
    }).withRelated('author',
                   factory.addResource('authors', '1').withAttributes({
                     name: 'Arthur Faulkner'
                   }).withRelated('flavor',
                                  factory.addResource('flavors', 'vanilla'))
                  )
      .withRelated('tags', [
        factory.addResource('tags', 'one'),
        factory.addResource('tags', 'two')
      ])
      .withRelated('collaborators', [
        factory.addResource('authors', '2').withAttributes({
          name: 'Quint Faulkner'
        })
      ]);

    factory.addResource('posts', '2').withAttributes({
      title: 'Second Post',
      subtitle: 'This one has no author'
    });


    let sessions = {};

    {
      let user = factory.addResource('test-users').withAttributes({
        fullName: 'Alice'
      });
      sessions.postAndTagResources = new Session(user);
      factory.addResource('grants')
        .withRelated('who', [{ type: user.type, id: user.id }])
        .withRelated('types', [
          factory.getResource('content-types', 'posts'),
          factory.getResource('content-types', 'tags')
        ])
        .withAttributes({
          mayReadResource: true
        });
    }

    {
      let user = factory.addResource('test-users').withAttributes({
        fullName: 'Bob'
      });
      sessions.postAndAuthorResourcesWithTitleAndAuthorFields = new Session(user);
      factory.addResource('grants')
        .withRelated('who', [{ type: user.type, id: user.id }])
        .withRelated('types', [
          factory.getResource('content-types', 'posts'),
          factory.getResource('content-types', 'authors')
        ])
        .withRelated('fields', [
          factory.getResource('fields', 'title'),
          factory.getResource('fields', 'author')
        ])
        .withAttributes({
          mayReadResource: true,
          mayReadFields: true
        });
    }

    {
      let user = factory.addResource('test-users').withAttributes({
        fullName: 'Charlie'
      });
      sessions.postResourceWithUnlimitedFieldsAndAuthorResource = new Session(user);
      factory.addResource('grants')
        .withRelated('who', [{ type: user.type, id: user.id }])
        .withRelated('types', [
          factory.getResource('content-types', 'posts')
        ])
        .withAttributes({
          mayReadResource: true,
          mayReadFields: true
        });
      factory.addResource('grants')
        .withRelated('who', [{ type: user.id, id: user.id }])
        .withRelated('types', [
          factory.getResource('content-types', 'authors')
        ])
        .withAttributes({
          mayReadResource: true
        });
    }

    env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-project`, factory.getModels());
    baseSchema = await env.lookup('hub:current-schema').forControllingBranch();
    searchers = env.lookup('hub:searchers');
  });

  after(async function() {
    if (env) {
      await destroyDefaultEnvironment(env);
    }
  });

  it("returns nothing when user has no grant", async function() {
    let model = await find('posts', '1');
    let approved = await baseSchema.applyReadAuthorization(model, { session: Session.EVERYONE });
    expect(approved).to.be.undefined;
  });

  it("returns resource when user has a grant with unrestricted type", async function() {
    let model = await find('posts', '1');
    let { schema, session } = await withGrants(factory => {
      factory.addResource('grants')
        .withAttributes({
          mayReadResource: true
        });
    });
    let approved = await schema.applyReadAuthorization(model, { session });
    expect(approved).has.deep.property('data.id', '1');
  });

  it("returns resource when user has a grant with matching type", async function() {
    let model = await find('posts', '1');
    let { schema, session } = await withGrants(factory => {
      factory.addResource('grants')
        .withRelated('types', [
          { type: 'content-types', id: 'posts' },
        ])
        .withAttributes({
          mayReadResource: true
        });
    });
    let approved = await schema.applyReadAuthorization(model, { session });
    expect(approved).has.deep.property('data.id', '1');
  });

  it("returns nothing when user has a grant with a different type", async function() {
    let model = await find('posts', '1');
    let { schema, session } = await withGrants(factory => {
      factory.addResource('grants')
        .withRelated('types', [
          { type: 'content-types', id: 'authors' },
        ])
        .withAttributes({
          mayReadResource: true
        });
    });
    let approved = await schema.applyReadAuthorization(model, { session });
    expect(approved).to.be.undefined;
  });

  it("removes unauthorized attributes when user has no mayReadFields grant", async function() {
    let model = await find('posts', '1');
    let { schema, session } = await withGrants(factory => {
      factory.addResource('grants')
        .withRelated('types', [
          { type: 'content-types', id: 'posts' },
        ])
        .withAttributes({
          mayReadResource: true
        });
    });
    let approved = await schema.applyReadAuthorization(model, { session });
    expect(approved).not.has.deep.property('data.attributes.title');
  });

  it("removes unauthorized attributes when user has a limited mayReadFields grant", async function() {
    let model = await find('posts', '1');
    let { schema, session } = await withGrants(factory => {
      factory.addResource('grants')
        .withRelated('types', [
          { type: 'content-types', id: 'posts' },
        ])
        .withRelated('fields', [
          { type: 'fields', id: 'title' }
        ])
        .withAttributes({
          mayReadResource: true,
          mayReadFields: true
        });
    });
    let approved = await schema.applyReadAuthorization(model, { session });
    expect(approved).not.has.deep.property('data.attributes.subtitle');
  });

  it("keeps authorized attributes when user has an unlimited mayReadFields grant", async function() {
    let model = await find('posts', '1');
    let { schema, session } = await withGrants(factory => {
      factory.addResource('grants')
        .withRelated('types', [
          { type: 'content-types', id: 'posts' },
        ])
        .withAttributes({
          mayReadResource: true,
          mayReadFields: true
        });
    });
    let approved = await schema.applyReadAuthorization(model, { session });
    expect(approved).has.deep.property('data.attributes.subtitle', 'It is the best');
  });

  it("keeps authorized attributes when user has a limited mayReadFields grant", async function() {
    let model = await find('posts', '1');
    let { schema, session } = await withGrants(factory => {
      factory.addResource('grants')
        .withRelated('types', [
          { type: 'content-types', id: 'posts' },
        ])
        .withRelated('fields', [
          { type: 'fields', id: 'title' }
        ])
        .withAttributes({
          mayReadResource: true,
          mayReadFields: true
        });
    });
    let approved = await schema.applyReadAuthorization(model, { session });
    expect(approved).has.deep.property('data.attributes.title', 'First Post');
  });

  it("removes unauthorized attributes from collection document", async function() {
    let model = await findAll('posts', '1');
    let { schema, session } = await withGrants(factory => {
      factory.addResource('grants')
        .withRelated('types', [
          { type: 'content-types', id: 'posts' },
        ])
        .withRelated('fields', [
          { type: 'fields', id: 'title' }
        ])
        .withAttributes({
          mayReadResource: true,
          mayReadFields: true
        });
    });
    let approved = await schema.applyReadAuthorization(model, { session });
    expect(approved.data[0]).not.has.deep.property('attributes.subtitle');
  });


  it("keeps authorized attributes in collection document", async function() {
    let model = await findAll('posts', '1');
    let { schema, session } = await withGrants(factory => {
      factory.addResource('grants')
        .withRelated('types', [
          { type: 'content-types', id: 'posts' },
        ])
        .withRelated('fields', [
          { type: 'fields', id: 'title' }
        ])
        .withAttributes({
          mayReadResource: true,
          mayReadFields: true
        });
    });
    let approved = await schema.applyReadAuthorization(model, { session });
    expect(approved.data[0]).has.deep.property('attributes.title');
  });

  it("keeps linked includes in collection document", async function() {
    let model = await findAll('posts', '1');
    let { schema, session } = await withGrants(factory => {
      factory.addResource('grants')
        .withRelated('types', [
          { type: 'content-types', id: 'posts' },
          { type: 'content-types', id: 'authors' },
        ])
        .withRelated('fields', [
          { type: 'fields', id: 'author' }
        ])
        .withAttributes({
          mayReadResource: true,
          mayReadFields: true
        });
    });
    let approved = await schema.applyReadAuthorization(model, { session });
    expect(approved.included).collectionContains({ type: 'authors' });
  });

  it("removes unlinked includes in collection document", async function() {
    let model = await findAll('posts', '1');
    let { schema, session } = await withGrants(factory => {
      factory.addResource('grants')
        .withRelated('types', [
          { type: 'content-types', id: 'posts' }
        ])
        .withRelated('fields', [
          { type: 'fields', id: 'author' }
        ])
        .withAttributes({
          mayReadResource: true,
          mayReadFields: true
        });
    });
    let approved = await schema.applyReadAuthorization(model, { session });
    expect(approved.included).not.collectionContains({ type: 'authors' });
  });


  it("removes unauthorized relationships when no field grant", async function() {
    let model = await find('posts', '1');
    let { schema, session } = await withGrants(factory => {
      factory.addResource('grants')
        .withRelated('types', [
          { type: 'content-types', id: 'posts' },
        ])
        .withAttributes({
          mayReadResource: true
        });
    });
    let approved = await schema.applyReadAuthorization(model, { session });
    expect(approved).not.has.deep.property('data.relationships.author');
  });

  it("removes unauthorized relationships when limited field grant", async function() {
    let model = await find('posts', '1');
    let { schema, session } = await withGrants(factory => {
      factory.addResource('grants')
        .withRelated('types', [
          { type: 'content-types', id: 'posts' },
        ])
        .withRelated('fields', [
          { type: 'fields', id: 'title' }
        ])
        .withAttributes({
          mayReadResource: true,
          mayReadFields: true
        });
    });
    let approved = await schema.applyReadAuthorization(model, { session });
    expect(approved).not.has.deep.property('data.relationships.author');
  });

  it("keeps authorized relationships when unlimited field grant", async function() {
    let model = await find('posts', '1');
    let { schema, session } = await withGrants(factory => {
      factory.addResource('grants')
        .withRelated('types', [
          { type: 'content-types', id: 'posts' },
        ])
        .withAttributes({
          mayReadResource: true,
          mayReadFields: true
        });
    });
    let approved = await schema.applyReadAuthorization(model, { session });
    expect(approved).has.deep.property('data.relationships.author.data.id', '1');
  });

  it("keeps authorized relationships when limited field grant", async function() {
    let model = await find('posts', '1');
    let { schema, session } = await withGrants(factory => {
      factory.addResource('grants')
        .withRelated('types', [
          { type: 'content-types', id: 'posts' },
        ])
        .withRelated('fields', [
          { type: 'fields', id: 'author' }
        ])
        .withAttributes({
          mayReadResource: true,
          mayReadFields: true
        });
    });
    let approved = await schema.applyReadAuthorization(model, { session });
    expect(approved).has.deep.property('data.relationships.author.data.id', '1');
  });

  it("removes authorized includes when their relationship field is unauthorized", async function(){
    let model = await find('posts', '1');
    let { schema, session } = await withGrants(factory => {
      factory.addResource('grants')
        .withRelated('types', [
          { type: 'content-types', id: 'posts' },
          { type: 'content-types', id: 'tags' },
          { type: 'content-types', id: 'authors' }
        ])
        .withRelated('fields', [
          { type: 'fields', id: 'author' }
        ])
        .withAttributes({
          mayReadResource: true,
          mayReadFields: true
        });
    });
    let approved = await schema.applyReadAuthorization(model, { session });
    expect(approved.included).not.collectionContains({ type: 'tags' });
  });

  it("when adjusting includes, keeps valid belongs-to relationships", async function(){
    let model = await find('posts', '1');
    let { schema, session } = await withGrants(factory => {
      factory.addResource('grants')
        .withRelated('types', [
          { type: 'content-types', id: 'posts' },
          { type: 'content-types', id: 'tags' },
          { type: 'content-types', id: 'authors' }
        ])
        .withRelated('fields', [
          { type: 'fields', id: 'author' }
        ])
        .withAttributes({

          mayReadResource: true,
          mayReadFields: true
        });
    });
    let approved = await schema.applyReadAuthorization(model, { session });
    expect(approved.included).collectionContains({ type: 'authors' });
  });

  it("when adjusting includes, keeps valid has-many relationships", async function(){
    let model = await find('posts', '1');
    let { schema, session } = await withGrants(factory => {
      factory.addResource('grants')
        .withRelated('types', [
          { type: 'content-types', id: 'posts' },
          { type: 'content-types', id: 'tags' },
          { type: 'content-types', id: 'authors' }
        ])
        .withRelated('fields', [
          { type: 'fields', id: 'tags' }
        ])
        .withAttributes({
          mayReadResource: true,
          mayReadFields: true
        });
    });
    let approved = await schema.applyReadAuthorization(model, { session });
    expect(approved.included).collectionContains({ type: 'tags' });
  });


  it("keeps authorized includes when their relationship field is authorized by an unlimited field grant", async function(){
    let model = await find('posts', '1');
    let { schema, session } = await withGrants(factory => {
      factory.addResource('grants')
        .withRelated('types', [
          { type: 'content-types', id: 'posts' },
          { type: 'content-types', id: 'authors' }
        ])
        .withAttributes({
          mayReadResource: true,
          mayReadFields: true
        });
    });
    let approved = await schema.applyReadAuthorization(model, { session });
    expect(approved.included).collectionContains({ type: 'authors', id: '1' });
  });

  it("keeps authorized includes when their relationship field is authorized by a limited field grant", async function(){
    let model = await find('posts', '1');
    let { schema, session } = await withGrants(factory => {
      factory.addResource('grants')
        .withRelated('types', [
          { type: 'content-types', id: 'posts' },
          { type: 'content-types', id: 'authors' }
        ])
        .withRelated('fields', [
          { type: 'fields', id: 'author' }
        ])
        .withAttributes({
          mayReadResource: true,
          mayReadFields: true
        });
    });
    let approved = await schema.applyReadAuthorization(model, { session });
    expect(approved.included).collectionContains({ type: 'authors' });
  });

  it("removes unauthorized includes when their relationship field is unauthorized", async function() {
    let model = await find('posts', '1');
    let { schema, session } = await withGrants(factory => {
      factory.addResource('grants')
        .withRelated('types', [
          { type: 'content-types', id: 'posts' },
          { type: 'content-types', id: 'authors' }
        ])
        .withRelated('fields', [
          { type: 'fields', id: 'author' }
        ])
        .withAttributes({
          mayReadResource: true,
          mayReadFields: true
        });
    });
    let approved = await schema.applyReadAuthorization(model, { session });
    expect(approved.included).not.collectionContains({ type: 'tags' });
  });

  it("removes unauthorized includes even when their relationship field is authorized by a limited field grant", async function(){
    let model = await find('posts', '1');
    let { schema, session } = await withGrants(factory => {
      factory.addResource('grants')
        .withRelated('types', [
          { type: 'content-types', id: 'posts' },
          { type: 'content-types', id: 'authors' }
        ])
        .withRelated('fields', [
          { type: 'fields', id: 'author' },
          { type: 'fields', id: 'tags' }
        ])
        .withAttributes({
          mayReadResource: true,
          mayReadFields: true
        });
    });
    let approved = await schema.applyReadAuthorization(model, { session });
    expect(approved.included).not.collectionContains({ type: 'tags' });
  });

  it("removes unauthorized includes even when their relationship field is authorized by an unlimited field grant", async function(){
    let model = await find('posts', '1');
    let { schema, session } = await withGrants(factory => {
      factory.addResource('grants')
        .withRelated('types', [
          { type: 'content-types', id: 'posts' },
          { type: 'content-types', id: 'authors' }
        ])
        .withAttributes({
          mayReadResource: true,
          mayReadFields: true
        });
    });
    let approved = await schema.applyReadAuthorization(model, { session });
    expect(approved.included).not.collectionContains({ type: 'tags' });
  });

  it("keeps linked second-level authorized includes", async function() {
    let model = await find('posts', '1');
    let { schema, session } = await withGrants(factory => {
      factory.addResource('grants')
        .withRelated('types', [
          { type: 'content-types', id: 'posts' },
          { type: 'content-types', id: 'authors' },
          { type: 'content-types', id: 'flavors' },
          { type: 'content-types', id: 'tags' }
        ])
        .withRelated('fields', [
          { type: 'fields', id: 'author' },
          { type: 'fields', id: 'flavor' }
        ])
        .withAttributes({
          mayReadResource: true,
          mayReadFields: true
        });
    });
    let approved = await schema.applyReadAuthorization(model, { session });
    expect(approved.included).collectionContains({ type: 'flavors' });
  });

  it("removes unlinked second-level authorized includes", async function() {
    let model = await find('posts', '1');
    let { schema, session } = await withGrants(factory => {
      factory.addResource('grants')
        .withRelated('types', [
          { type: 'content-types', id: 'posts' },
          { type: 'content-types', id: 'authors' },
          { type: 'content-types', id: 'flavors' },
          { type: 'content-types', id: 'tags' }
        ])
        .withRelated('fields', [
          { type: 'fields', id: 'flavor' }
        ])
        .withAttributes({
          mayReadResource: true,
          mayReadFields: true
        });
    });
    let approved = await schema.applyReadAuthorization(model, { session });
    expect(approved.included).not.collectionContains({ type: 'flavors' });
  });

  it("removes unauthorized attributes from includes", async function(){
    let model = await find('posts', '1');
    let { schema, session } = await withGrants(factory => {
      factory.addResource('grants')
        .withRelated('types', [
          { type: 'content-types', id: 'posts' },
          { type: 'content-types', id: 'authors' }
        ])
        .withRelated('fields', [
          { type: 'fields', id: 'author' }
        ])
        .withAttributes({
          mayReadResource: true,
          mayReadFields: true
        });
    });
    let approved = await schema.applyReadAuthorization(model, { session });
    expect(approved.included).has.length(1);
    expect(approved.included[0]).has.deep.property('type', 'authors');
    expect(approved.included[0]).not.has.deep.property('attributes.name');
  });

  it("keeps unauthorized attributes in includes", async function(){
    let model = await find('posts', '1');
    let { schema, session } = await withGrants(factory => {
      factory.addResource('grants')
        .withRelated('types', [
          { type: 'content-types', id: 'posts' },
          { type: 'content-types', id: 'authors' }
        ])
        .withRelated('fields', [
          { type: 'fields', id: 'author' },
          { type: 'fields', id: 'name' }
        ])
        .withAttributes({
          mayReadResource: true,
          mayReadFields: true
        });
    });
    let approved = await schema.applyReadAuthorization(model, { session });
    expect(approved.included).has.length(1);
    expect(approved.included[0]).has.deep.property('type', 'authors');
    expect(approved.included[0]).has.deep.property('attributes.name');
  });

  it("approves field-dependent grant for resource", async function() {
    let model = await find('posts', '1');
    let factory = new JSONAPIFactory();

    factory.addResource('grants')
      .withRelated('who', [{ type: 'fields', id: 'author' }])
      .withRelated('types', [
        { type: 'content-types', id: 'posts' }
      ])
      .withAttributes({
        mayReadResource: true,
        mayReadFields: true
      });

    let session = new Session({ type: 'authors', id: '1' });
    let schema = await baseSchema.applyChanges(factory.getModels().map(model => ({ type: model.type, id: model.id, document: model })));
    let approved = await schema.applyReadAuthorization(model, { session });
    expect(approved).is.not.undefined;
  });

  it("rejects field-dependent grant for resource when value is mismatched", async function() {
    let model = await find('posts', '1');
    let factory = new JSONAPIFactory();

    factory.addResource('grants')
      .withRelated('who', [{ type: 'fields', id: 'author' }])
      .withRelated('types', [
        { type: 'content-types', id: 'posts' }
      ])
      .withAttributes({
        mayReadResource: true,
        mayReadFields: true
      });

    let session = new Session({ type: 'authors', id: '2' });
    let schema = await baseSchema.applyChanges(factory.getModels().map(model => ({ type: model.type, id: model.id, document: model })));
    let approved = await schema.applyReadAuthorization(model, { session });
    expect(approved).is.undefined;
  });

  it("rejects field-dependent grant for resource when type is mismatched", async function() {
    let model = await find('posts', '1');
    let factory = new JSONAPIFactory();

    factory.addResource('grants')
      .withRelated('who', [{ type: 'fields', id: 'author' }])
      .withRelated('types', [
        { type: 'content-types', id: 'posts' }
      ])
      .withAttributes({
        mayReadResource: true,
        mayReadFields: true
      });

    let session = new Session({ type: 'test-users', id: '1' });
    let schema = await baseSchema.applyChanges(factory.getModels().map(model => ({ type: model.type, id: model.id, document: model })));
    let approved = await schema.applyReadAuthorization(model, { session });
    expect(approved).is.undefined;
  });

  it("rejects field-dependent grant for resource when field is null", async function() {
    let model = await find('posts', '2');
    let factory = new JSONAPIFactory();

    factory.addResource('grants')
      .withRelated('who', [{ type: 'fields', id: 'author' }])
      .withRelated('types', [
        { type: 'content-types', id: 'posts' }
      ])
      .withAttributes({
        mayReadResource: true,
        mayReadFields: true
      });

    let session = new Session({ type: 'authors', id: '1' });
    let schema = await baseSchema.applyChanges(factory.getModels().map(model => ({ type: model.type, id: model.id, document: model })));
    let approved = await schema.applyReadAuthorization(model, { session });
    expect(approved).is.undefined;
  });


  it("approves field-dependent grant for all fields", async function() {
    let model = await find('posts', '1');
    let factory = new JSONAPIFactory();

    factory.addResource('grants')
      .withRelated('who', [{ type: 'authors', id: '1' }])
      .withAttributes({
        mayReadResource: true
      });

    factory.addResource('grants')
      .withRelated('who', [{ type: 'fields', id: 'author' }])
      .withAttributes({
        mayReadFields: true
      });

    let session = new Session({ type: 'authors', id: '1' });
    let schema = await baseSchema.applyChanges(factory.getModels().map(model => ({ type: model.type, id: model.id, document: model })));
    let approved = await schema.applyReadAuthorization(model, { session });
    expect(approved).has.deep.property('data.attributes.title');
  });

  it("rejects field-dependent grant for all fields", async function() {
    let model = await find('posts', '1');
    let factory = new JSONAPIFactory();

    factory.addResource('grants')
      .withRelated('who', [{ type: 'authors', id: '2' }])
      .withAttributes({
        mayReadResource: true
      });

    factory.addResource('grants')
      .withRelated('who', [{ type: 'fields', id: 'author' }])
      .withAttributes({
        mayReadFields: true
      });

    let session = new Session({ type: 'authors', id: '2' });
    let schema = await baseSchema.applyChanges(factory.getModels().map(model => ({ type: model.type, id: model.id, document: model })));
    let approved = await schema.applyReadAuthorization(model, { session });
    expect(approved).not.has.deep.property('data.attributes.title');
  });

  it("approves field-dependent grant for specific fields", async function() {
    let model = await find('posts', '1');
    let factory = new JSONAPIFactory();

    factory.addResource('grants')
      .withRelated('who', [{ type: 'authors', id: '1' }])
      .withAttributes({
        mayReadResource: true
      });

    factory.addResource('grants')
      .withRelated('who', [{ type: 'fields', id: 'author' }])
      .withRelated('fields', [
        { type: 'fields', id: 'title' }
      ])
      .withAttributes({
        mayReadFields: true
      });

    let session = new Session({ type: 'authors', id: '1' });
    let schema = await baseSchema.applyChanges(factory.getModels().map(model => ({ type: model.type, id: model.id, document: model })));
    let approved = await schema.applyReadAuthorization(model, { session });
    expect(approved).has.deep.property('data.attributes.title');
  });

  it("rejects field-dependent grant for specific fields", async function() {
    let model = await find('posts', '1');
    let factory = new JSONAPIFactory();

    factory.addResource('grants')
      .withRelated('who', [{ type: 'authors', id: '2' }])
      .withAttributes({
        mayReadResource: true
      });

    factory.addResource('grants')
      .withRelated('who', [{ type: 'fields', id: 'author' }])
      .withRelated('fields', [
        { type: 'fields', id: 'title' }
      ])
      .withAttributes({
        mayReadFields: true
      });

    let session = new Session({ type: 'authors', id: '2' });
    let schema = await baseSchema.applyChanges(factory.getModels().map(model => ({ type: model.type, id: model.id, document: model })));
    let approved = await schema.applyReadAuthorization(model, { session });
    expect(approved).not.has.deep.property('data.attributes.title');
  });

  it("approves hasMany field-dependent grant", async function() {
    let model = await find('posts', '1');
    let factory = new JSONAPIFactory();

    factory.addResource('grants')
      .withRelated('who', [{ type: 'fields', id: 'collaborators' }])
      .withAttributes({
        mayReadResource: true
      });

    let session = new Session({ type: 'authors', id: '2' });
    let schema = await baseSchema.applyChanges(factory.getModels().map(model => ({ type: model.type, id: model.id, document: model })));
    let approved = await schema.applyReadAuthorization(model, { session });
    expect(approved).has.deep.property('data.id', '1');
  });

  it("rejects hasMany field-dependent grant", async function() {
    let model = await find('posts', '1');
    let factory = new JSONAPIFactory();

    factory.addResource('grants')
      .withRelated('who', [{ type: 'fields', id: 'collaborators' }])
      .withAttributes({
        mayReadResource: true
      });

    let session = new Session({ type: 'authors', id: '1' });
    let schema = await baseSchema.applyChanges(factory.getModels().map(model => ({ type: model.type, id: model.id, document: model })));
    let approved = await schema.applyReadAuthorization(model, { session });
    expect(approved).to.be.undefined;
  });

});
