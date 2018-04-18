const ElasticAssert = require('@cardstack/elasticsearch/node-tests/assertions');
const JSONAPIFactory = require('../../../tests/stub-project/node_modules/@cardstack/test-support/jsonapi-factory');
const PendingChange = require('@cardstack/plugin-utils/pending-change');
const bootstrapSchema = require('../bootstrap-schema');
const { Registry, Container } = require('@cardstack/di');
const Session = require('@cardstack/plugin-utils/session');

const everyone = { type: 'groups', id: 'everyone' };

describe('schema/auth/write', function() {

  let factory, loader;

  beforeEach(async function() {
    factory = new JSONAPIFactory();
    factory.importModels(bootstrapSchema);

    factory.addResource('content-types', 'articles')
      .withRelated('fields', [
        factory.addResource('fields', 'title')
          .withAttributes({ fieldType: '@cardstack/core-types::string' }),
        factory.addResource('fields', 'coolness')
          .withAttributes({
            fieldType: '@cardstack/core-types::integer'
          }).withRelated(
            'defaultAtCreate',
            factory.addResource('default-values').withAttributes({ value: 0 })
          ),
        factory.addResource('fields', 'reviewed')
          .withAttributes({
            fieldType: '@cardstack/core-types::boolean'
          }).withRelated(
            'defaultAtUpdate',
            factory.addResource('default-values').withAttributes({ value: false })
          )
      ]);

    factory.addResource('content-types', 'events')
      .withRelated('fields', [
        factory.getResource('fields', 'title')
      ]);
    let registry = new Registry();
    registry.register('config:project', { path: `${__dirname}/../../../tests/stub-project` });
    loader = new Container(registry).lookup('hub:schema-loader');
  });

  afterEach(async function() {
    let ea = new ElasticAssert();
    await ea.deleteContentIndices();
  });

  function allReadable() {
    factory.addResource('grants').withAttributes({
      mayReadResource: true,
      mayReadFields: true
    }).withRelated('who', everyone);
  }

  it("attempting to create a thing you can't read results in Not Found", async function() {
    let schema = await loader.loadFrom(factory.getModels());
    let action = create({
      type: 'articles',
      id: '1'
    });
    let errors = await schema.validationErrors(action);
    expect(errors).collectionContains({
      status: 404,
      detail: 'Not found'
    });
  });


  it("forbids creation", async function() {
    allReadable();
    let schema = await loader.loadFrom(factory.getModels());
    let action = create({
      type: 'articles',
      id: '1'
    });
    let errors = await schema.validationErrors(action);
    expect(errors).collectionContains({
      status: 401,
      detail: 'You may not create this resource'
    });
  });

  it("everyone grant allows creation when there's no session", async function() {
    allReadable();
    factory.addResource('grants').withAttributes({ mayCreateResource: true }).withRelated('who', everyone);
    let schema = await loader.loadFrom(factory.getModels());
    let action = create({
      type: 'articles'
    });
    let errors = await schema.validationErrors(action);
    expect(errors).deep.equal([]);
  });

  it("everyone grant allows creation when there's some session", async function() {
    allReadable();
    factory.addResource('grants').withAttributes({ mayCreateResource: true }).withRelated('who', everyone);
    let schema = await loader.loadFrom(factory.getModels());
    let action = create({
      type: 'articles'
    });
    let session = new Session({ id: '0' }, null, { id: '0' });
    let errors = await schema.validationErrors(action, { session });
    expect(errors).deep.equal([]);
  });

  it("user-provided id denied without a grant", async function() {
    allReadable();
    factory.addResource('grants').withAttributes({ mayCreateResource: true }).withRelated('who', everyone);
    let schema = await loader.loadFrom(factory.getModels());
    let action = create({
      type: 'articles',
      id: '1'
    });
    let errors = await schema.validationErrors(action);
    expect(errors).collectionContains({
      status: 401,
      detail: 'You may not write field "id"'
    });
  });

  it("user-provided id approved with a grant", async function() {
    factory.addResource('grants').withAttributes({ mayCreateResource: true, mayReadResource: true }).withRelated('who', everyone);
    factory.addResource('grants').withAttributes({ mayWriteFields: true }).withRelated('who', everyone)
      .withRelated('fields', [
        factory.getResource('fields', 'id')
      ]);

    let schema = await loader.loadFrom(factory.getModels());
    let action = create({
      type: 'articles',
      id: '1'
    });
    let errors = await schema.validationErrors(action);
    expect(errors).deep.equals([]);
  });

  it("user-specific grant allows creation", async function() {
    allReadable();
    factory.addResource('grants').withAttributes({ mayCreateResource: true })
      .withRelated('who', { type: 'groups', id: '0' });
    let schema = await loader.loadFrom(factory.getModels());
    let action = create({
      type: 'articles'
    });
    let session = new Session({ id: '0' }, null, { id: '0' });
    let errors = await schema.validationErrors(action, { session });
    expect(errors).deep.equal([]);
  });

  it("id-dependent grant allows creation", async function() {
    allReadable();
    factory.addResource('grants').withAttributes({ mayCreateResource: true, mayWriteFields: true })
      .withRelated('who', { type: 'fields', id: 'id' });
    let schema = await loader.loadFrom(factory.getModels());
    let action = create({
      type: 'articles',
      id: '123'
    });
    let session = new Session({ id: '123' }, null, { id: '123' });
    let errors = await schema.validationErrors(action, { session });
    expect(errors).deep.equal([]);
  });

  it("id-dependent grant rejects creation", async function() {
    allReadable();
    factory.addResource('grants').withAttributes({ mayCreateResource: true, mayWriteFields: true })
      .withRelated('who', { type: 'fields', id: 'id' });
    let schema = await loader.loadFrom(factory.getModels());
    let action = create({
      type: 'articles',
      id: '124'
    });
    let session = new Session({ id: '123' }, null, { id: '123' });
    let errors = await schema.validationErrors(action, { session });
    expect(errors).collectionContains({
      status: 401,
      detail: 'You may not create this resource'
    });
  });

  it("attribute-dependent grant allows creation", async function() {
    allReadable();
    factory.addResource('grants').withAttributes({ mayCreateResource: true, mayWriteFields: true })
      .withRelated('who', { type: 'fields', id: 'title' });
    let schema = await loader.loadFrom(factory.getModels());
    let action = create({
      type: 'articles',
      attributes: {
        title: '123'
      }
    });
    let session = new Session({ id: '123' }, null, { id: '123' });
    let errors = await schema.validationErrors(action, { session });
    expect(errors).deep.equal([]);
  });

  it("attribute-dependent grant rejects creation", async function() {
    allReadable();
    factory.addResource('grants').withAttributes({ mayCreateResource: true, mayWriteFields: true })
      .withRelated('who', { type: 'fields', id: 'title' });
    let schema = await loader.loadFrom(factory.getModels());
    let action = create({
      type: 'articles',
      attributes: {
        title: '124'
      }

    });
    let session = new Session({ id: '123' }, null, { id: '123' });
    let errors = await schema.validationErrors(action, { session });
    expect(errors).collectionContains({
      status: 401,
      detail: 'You may not create this resource'
    });
  });


  it("user-specific grant doesn't match missing user", async function() {
    allReadable();
    factory.addResource('grants').withAttributes({ mayCreateResource: true })
      .withRelated('who', { type: 'groups', id: '0' });
    let schema = await loader.loadFrom(factory.getModels());
    let action = create({
      type: 'articles',
      id: '1'
    });
    let errors = await schema.validationErrors(action);
    expect(errors).collectionContains({
      status: 401,
      detail: 'You may not create this resource'
    });
  });

  it("user-specific grant doesn't match wrong user", async function() {
    allReadable();
    factory.addResource('grants').withAttributes({ mayCreateResource: true })
      .withRelated('who', { type: 'groups', id: '0' });
    let schema = await loader.loadFrom(factory.getModels());
    let action = create({
      type: 'articles',
      id: '1'
    });
    let errors = await schema.validationErrors(action, { user: { id: 1 }});
    expect(errors).collectionContains({
      status: 401,
      detail: 'You may not create this resource'
    });
  });

  it("allows by type", async function() {
    allReadable();
    factory.addResource('grants').withAttributes({ mayCreateResource: true })
      .withRelated('who', everyone)
      .withRelated('types', [factory.getResource('content-types', 'articles')]);
    let schema = await loader.loadFrom(factory.getModels());
    let action = create({
      type: 'articles'
    });
    let errors = await schema.validationErrors(action);
    expect(errors).deep.equal([]);
  });

  it("forbids by type", async function() {
    allReadable();
    factory.addResource('grants').withAttributes({ mayCreateResource: true })
      .withRelated('who', everyone)
      .withRelated('types', [factory.getResource('content-types', 'articles')]);
    let schema = await loader.loadFrom(factory.getModels());
    let action = create({
      type: 'events',
      id: '1'
    });
    let errors = await schema.validationErrors(action);
    expect(errors).collectionContains({
      status: 401,
      detail: 'You may not create this resource'
    });
  });

  it("forbids deletion", async function() {
    let schema = await loader.loadFrom(factory.getModels());
    let action = deleteIt({
      type: 'articles',
      id: '1'
    });
    let errors = await schema.validationErrors(action);
    expect(errors).collectionContains({
      status: 401,
      detail: 'You may not delete this resource'
    });
  });

  it("forbids update", async function() {
    allReadable();
    let schema = await loader.loadFrom(factory.getModels());
    let action = update({
      type: 'articles',
      id: '1',
      attributes: {
        title: 'x'
      }
    },{
      type: 'articles',
      id: '1',
      attributes: {
        title: 'y'
      }
    });
    let errors = await schema.validationErrors(action);
    expect(errors).collectionContains({
      status: 401,
      detail: 'You may not update this resource'
    });
  });

  it("forbids update when attribute-dependent grant does not match initial state", async function() {
    factory.addResource('grants').withAttributes({ mayReadResource: true })
      .withRelated('who', everyone);
    factory.addResource('grants').withAttributes({ mayUpdateResource: true, mayWriteFields: true })
      .withRelated('who', { type: 'fields', id: 'title' });
    let schema = await loader.loadFrom(factory.getModels());
    let action = update({
      type: 'articles',
      id: '1',
      attributes: {
        title: '124'
      }
    },{
      type: 'articles',
      id: '1',
      attributes: {
        title: '123'
      }
    });
    let session = new Session({ id: '123' }, null, { id: '123' });
    let errors = await schema.validationErrors(action, { session });
    expect(errors).collectionContains({
      status: 401,
      detail: 'You may not update this resource'
    });
  });

  it("allows update when attribute-dependent grant matches initial state", async function() {
    factory.addResource('grants').withAttributes({ mayReadResource: true })
      .withRelated('who', everyone);
    factory.addResource('grants').withAttributes({ mayUpdateResource: true, mayWriteFields: true })
      .withRelated('who', { type: 'fields', id: 'title' });
    let schema = await loader.loadFrom(factory.getModels());
    let action = update({
      type: 'articles',
      id: '1',
      attributes: {
        title: '123'
      }
    },{
      type: 'articles',
      id: '1',
      attributes: {
        title: '124'
      }
    });
    let session = new Session({ id: '123' }, null, { id: '123' });
    let errors = await schema.validationErrors(action, { session });
    expect(errors).collectionContains({
      status: 401,
      detail: 'You may not update this resource'
    });
  });

  it("forbids deletion when attribute-dependent grant does not match", async function() {
    factory.addResource('grants').withAttributes({ mayDeleteResource: true })
      .withRelated('who', { type: 'fields', id: 'title' });

    let schema = await loader.loadFrom(factory.getModels());
    let action = deleteIt({
      type: 'articles',
      id: '1'
    });
    let session = new Session({ id: '123' }, null, { id: '123' });
    let errors = await schema.validationErrors(action, { session });
    expect(errors).collectionContains({
      status: 401,
      detail: 'You may not delete this resource'
    });
  });

  it("allows deletion when attribute-dependent grant matches", async function() {
    factory.addResource('grants').withAttributes({ mayDeleteResource: true })
      .withRelated('who', { type: 'fields', id: 'title' });

    let schema = await loader.loadFrom(factory.getModels());
    let action = deleteIt({
      type: 'articles',
      id: '1',
      attributes: {
        title: '123'
      }
    });
    let session = new Session({ id: '123' }, null, { id: '123' });
    let errors = await schema.validationErrors(action, { session });
    expect(errors).deep.equal([]);
  });


  it("approves field write at creation via grant", async function () {
    allReadable();
    factory.addResource('grants').withAttributes({ mayCreateResource: true, mayWriteFields: true }).withRelated('who', everyone);
    let schema = await loader.loadFrom(factory.getModels());
    let action = create({
      type: 'articles',
      id: '1',
      attributes: {
        title: "hello"
      }
    });
    let errors = await schema.validationErrors(action);
    expect(errors).deep.equal([]);
  });

  it("approves null field write at creation when no default is set", async function () {
    allReadable();
    factory.addResource('grants').withAttributes({ mayCreateResource: true }).withRelated('who', everyone);
    let schema = await loader.loadFrom(factory.getModels());
    let action = create({
      type: 'articles',
      attributes: {
        title: null
      }
    });
    let errors = await schema.validationErrors(action);
    expect(errors).deep.equal([]);
  });

  it("rejects null field write at creation when default is set", async function () {
    allReadable();
    factory.addResource('grants').withAttributes({ mayCreateResource: true }).withRelated('who', everyone);
    let schema = await loader.loadFrom(factory.getModels());
    let action = create({
      type: 'articles',
      id: '1',
      attributes: {
        coolness: null
      }
    });
    let errors = await schema.validationErrors(action);
    expect(errors).collectionContains({
      status: 401,
      detail: 'You may not write field "coolness"'
    });
  });


  it("approves field write at creation when it matches default value", async function () {
    allReadable();
    factory.addResource('grants').withAttributes({ mayCreateResource: true }).withRelated('who', everyone);
    let schema = await loader.loadFrom(factory.getModels());
    let action = create({
      type: 'articles',
      attributes: {
        coolness: 0
      }
    });
    let errors = await schema.validationErrors(action);
    expect(errors).to.deep.equal([]);
  });


  it("rejects field write at creation", async function () {
    allReadable();
    factory.addResource('grants').withAttributes({ mayCreateResource: true }).withRelated('who', everyone);
    let schema = await loader.loadFrom(factory.getModels());
    let action = create({
      type: 'articles',
      id: '1',
      attributes: {
        title: "hello"
      }
    });
    let errors = await schema.validationErrors(action);
    expect(errors).collectionContains({
      status: 401,
      detail: 'You may not write field "title"'
    });
  });

  it("approves field write at update via grant", async function () {
    allReadable();
    factory.addResource('grants').withAttributes({ mayUpdateResource: true, mayWriteFields: true }).withRelated('who', everyone);
    let schema = await loader.loadFrom(factory.getModels());
    let action = update({
      type: 'articles',
      id: '1',
      attributes: {
        coolness: 6
      }
    },{
      type: 'articles',
      id: '1',
      attributes: {
        coolness: 7
      }
    });
    let errors = await schema.validationErrors(action);
    expect(errors).to.deep.equal([]);
  });

  it("approves via a field-specific grant", async function () {
    allReadable();
    factory.addResource('grants').withAttributes({ mayUpdateResource: true, mayWriteFields: true })
      .withRelated('who', everyone)
      .withRelated('fields', [
        factory.getResource('fields', 'coolness')
      ]);
    let schema = await loader.loadFrom(factory.getModels());
    let action = update({
      type: 'articles',
      id: '1',
      attributes: {
        coolness: 6
      }
    },{
      type: 'articles',
      id: '1',
      attributes: {
        coolness: 7
      }
    });
    let errors = await schema.validationErrors(action);
    expect(errors).to.deep.equal([]);
  });

  it("rejects a non-matching field-specific grant", async function () {
    allReadable();
    factory.addResource('grants').withAttributes({ mayUpdateResource: true, mayWriteFields: true })
      .withRelated('who', everyone)
      .withRelated('fields', [
        factory.getResource('fields', 'coolness')
      ]);
    let schema = await loader.loadFrom(factory.getModels());
    let action = update({
      type: 'articles',
      id: '1'
    },{
      type: 'articles',
      id: '1',
      attributes: {
        title: 'b'
      }
    });
    let errors = await schema.validationErrors(action);
    expect(errors).collectionContains({
      status: 401,
      detail: 'You may not write field "title"'
    });
  });


  it("approves field write at update via unchanged value", async function () {
    allReadable();
    factory.addResource('grants').withAttributes({ mayUpdateResource: true }).withRelated('who', everyone);
    let schema = await loader.loadFrom(factory.getModels());
    let action = update({
      type: 'articles',
      id: '1',
      attributes: {
        coolness: 6
      }
    },{
      type: 'articles',
      id: '1',
      attributes: {
        coolness: 6
      }
    });
    let errors = await schema.validationErrors(action);
    expect(errors).to.deep.equal([]);
  });

  it("approves field write at update when it matches default", async function () {
    allReadable();
    factory.addResource('grants').withAttributes({ mayUpdateResource: true }).withRelated('who', everyone);
    let schema = await loader.loadFrom(factory.getModels());
    let action = update({
      type: 'articles',
      id: '1',
      attributes: {
        reviewed: true
      }
    },{
      type: 'articles',
      id: '1',
      attributes: {
        reviewed: false
      }
    });
    let errors = await schema.validationErrors(action);
    expect(errors).to.deep.equal([]);
  });

  it("allows inclusion of non-changed field updateDefault will change it", async function () {
    allReadable();
    factory.addResource('grants').withAttributes({ mayUpdateResource: true }).withRelated('who', everyone);
    let schema = await loader.loadFrom(factory.getModels());
    let action = update({
      type: 'articles',
      id: '1',
      attributes: {
        reviewed: true
      }
    },{
      type: 'articles',
      id: '1',
      attributes: {
        reviewed: true
      }
    });
    let errors = await schema.validationErrors(action);
    expect(errors).to.deep.equal([]);
    expect(action.finalDocument.attributes.reviewed).to.equal(false);
  });

  it("rejects write of field that differs from updateDefault", async function () {
    allReadable();
    factory.addResource('grants').withAttributes({ mayUpdateResource: true }).withRelated('who', everyone);
    let schema = await loader.loadFrom(factory.getModels());
    let action = update({
      type: 'articles',
      id: '1',
      attributes: {
        reviewed: true
      }
    },{
      type: 'articles',
      id: '1',
      attributes: {
        reviewed: null
      }
    });
    let errors = await schema.validationErrors(action);
    expect(errors).collectionContains({
      status: 401,
      detail: 'You may not write field "reviewed"'
    });
  });

  it("rejects field write at update", async function () {
    allReadable();
    factory.addResource('grants').withAttributes({ mayUpdateResource: true }).withRelated('who', everyone);
    let schema = await loader.loadFrom(factory.getModels());
    let action = update({
      type: 'articles',
      id: '1',
      attributes: {
        coolness: 6
      }
    },{
      type: 'articles',
      id: '1',
      attributes: {
        coolness: 62
      }
    });
    let errors = await schema.validationErrors(action);
    expect(errors).collectionContains({
      status: 401,
      detail: 'You may not write field "coolness"'
    });
  });

  it("forbids creation of a resource that you're not authorized to read", async function() {
    // As a policy, we require you to have resource-level read auth on
    // things you are creating or updating. This is because we're
    // going to echo the results back to you, and we don't want there
    // to be any ambiguity that would allow secrets to leak.
    factory.addResource('grants').withAttributes({ mayCreateResource: true }).withRelated('who', everyone);
    let schema = await loader.loadFrom(factory.getModels());
    let action = create({
      type: 'articles',
      id: '1',
      attributes: {
        coolness: 6
      }
    });
    let errors = await schema.validationErrors(action);
    expect(errors).collectionContains({
      status: 404,
      detail: 'Not found'
    });
  });

  it("forbids update of a resource that you're not authorized to read", async function() {
    // As a policy, we require you to have resource-level read auth on
    // things you are creating or updating . This is because we're
    // going to echo the results back to you, and we don't want there
    // to be any ambiguity that would allow secrets to leak.
    factory.addResource('grants').withAttributes({ mayUpdateResource: true }).withRelated('who', everyone);
    let schema = await loader.loadFrom(factory.getModels());
    let action = update({
      type: 'articles',
      id: '1',
      attributes: {
        coolness: 6
      }
    },{
      type: 'articles',
      id: '1',
      attributes: {
        coolness: 6
      }
    });
    let errors = await schema.validationErrors(action);
    expect(errors).collectionContains({
      status: 404,
      detail: 'Not found'
    });
  });

  it("does not leak existence of fields you're not authorized to read, even if they are unchanged, during create", async function() {
    factory.addResource('grants').withAttributes({ mayReadResource: true }).withRelated('who', everyone);
    factory.addResource('grants').withAttributes({ mayCreateResource: true, mayWriteFields: true }).withRelated('who', everyone);
    let schema = await loader.loadFrom(factory.getModels());
    let action = create({
      type: 'articles',
      attributes: {
        title: null,
        coolness: 0
      }
    });
    let errors = await schema.validationErrors(action);
    expect(errors).collectionContains({
      status: 400,
      title: 'Validation error',
      detail: 'type "articles" has no field named "title"'
    });
    expect(errors).collectionContains({
      status: 400,
      title: 'Validation error',
      detail: 'type "articles" has no field named "coolness"'
    });
    expect(errors).has.length(2);
  });

  it("does not leak existence of fields you're not authorized to read during create", async function() {
    factory.addResource('grants').withAttributes({ mayReadResource: true }).withRelated('who', everyone);
    factory.addResource('grants').withAttributes({ mayCreateResource: true, mayWriteFields: true }).withRelated('who', everyone);
    let schema = await loader.loadFrom(factory.getModels());
    let action = create({
      type: 'articles',
      attributes: {
        title: "my title",
        coolness: 1
      }
    });
    let errors = await schema.validationErrors(action);
    expect(errors).collectionContains({
      status: 400,
      title: 'Validation error',
      detail: 'type "articles" has no field named "title"'
    });
    expect(errors).collectionContains({
      status: 400,
      title: 'Validation error',
      detail: 'type "articles" has no field named "coolness"'
    });
    expect(errors).has.length(2);
  });

  it("does not leak other errors for fields you're not authorized to read, during create", async function() {
    factory.addResource('grants').withAttributes({ mayReadResource: true }).withRelated('who', everyone);
    factory.addResource('grants').withAttributes({ mayCreateResource: true, mayWriteFields: true }).withRelated('who', everyone);
    let schema = await loader.loadFrom(factory.getModels());
    let action = create({
      type: 'articles',
      attributes: {
        // This is a format error
        coolness: "purple"
      }
    });
    let errors = await schema.validationErrors(action);
    expect(errors).collectionContains({
      status: 400,
      title: 'Validation error',
      detail: 'type "articles" has no field named "coolness"'
    });
    expect(errors).has.length(1);
  });


  it("does not leak existence of fields you're not authorized to read, even if they are unchanged, during update", async function() {
    factory.addResource('grants').withAttributes({ mayReadResource: true }).withRelated('who', everyone);
    factory.addResource('grants').withAttributes({ mayUpdateResource: true, mayWriteFields: true }).withRelated('who', everyone);
    let schema = await loader.loadFrom(factory.getModels());
    let action = update({
      type: 'articles',
      attributes: {
        title: 'a'
      }
    }, {
      type: 'articles',
      attributes: {
        title: 'a'
      }
    });
    let errors = await schema.validationErrors(action);
    expect(errors).collectionContains({
      status: 400,
      title: 'Validation error',
      detail: 'type "articles" has no field named "title"'
    });
    expect(errors).has.length(1);
  });

  it("does not leak existence of fields you're not authorized to read, during update", async function() {
    factory.addResource('grants').withAttributes({ mayReadResource: true }).withRelated('who', everyone);
    factory.addResource('grants').withAttributes({ mayUpdateResource: true, mayWriteFields: true }).withRelated('who', everyone);
    let schema = await loader.loadFrom(factory.getModels());
    let action = update({
      type: 'articles',
      attributes: {
        title: "old title",
        coolness: 0
      },
    }, {
      type: 'articles',
      attributes: {
        title: "new title",
        coolness: 1
      }
    });
    let errors = await schema.validationErrors(action);
    expect(errors).collectionContains({
      status: 400,
      title: 'Validation error',
      detail: 'type "articles" has no field named "title"'
    });
    expect(errors).collectionContains({
      status: 400,
      title: 'Validation error',
      detail: 'type "articles" has no field named "coolness"'
    });
    expect(errors).has.length(2);
  });

  it("does not leak other errors for fields you're not authorized to read, during update", async function() {
    factory.addResource('grants').withAttributes({ mayReadResource: true }).withRelated('who', everyone);
    factory.addResource('grants').withAttributes({ mayUpdateResource: true, mayWriteFields: true }).withRelated('who', everyone);
    let schema = await loader.loadFrom(factory.getModels());
    let action = update({
      type: 'articles',
      attributes: {
        coolness: 10
      }
    },{
      type: 'articles',
      attributes: {
        // This is a format error
        coolness: "purple"
      }
    });
    let errors = await schema.validationErrors(action);
    expect(errors).collectionContains({
      status: 400,
      title: 'Validation error',
      detail: 'type "articles" has no field named "coolness"'
    });
    expect(errors).has.length(1);
  });


});

function create(document) {
  return new PendingChange(null, document);
}

function deleteIt(document) {
  return new PendingChange(document, null);
}

function update(older, newer) {
  return new PendingChange(older, newer);
}
