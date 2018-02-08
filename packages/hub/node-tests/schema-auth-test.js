const ElasticAssert = require('@cardstack/elasticsearch/node-tests/assertions');
const JSONAPIFactory = require('../../../tests/stub-project/node_modules/@cardstack/test-support/jsonapi-factory');
const PendingChange = require('@cardstack/plugin-utils/pending-change');
const bootstrapSchema = require('../bootstrap-schema');
const { Registry, Container } = require('@cardstack/di');
const Session = require('@cardstack/plugin-utils/session');

const everyone = { type: 'groups', id: 'everyone' };

describe('schema/auth', function() {

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

  it("forbids creation", async function() {
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
    factory.addResource('grants').withAttributes({ mayCreateResource: true }).withRelated('who', everyone);
    let schema = await loader.loadFrom(factory.getModels());
    let action = create({
      type: 'articles'
    });
    let errors = await schema.validationErrors(action);
    expect(errors).deep.equal([]);
  });

  it("everyone grant allows creation when there's some session", async function() {
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
    factory.addResource('grants').withAttributes({ mayCreateResource: true }).withRelated('who', everyone);
    factory.addResource('grants').withAttributes({ mayWriteField: true }).withRelated('who', everyone)
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

  it("user-specific grant doesn't match missing user", async function() {
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

  it("approves field write at creation via grant", async function () {
    factory.addResource('grants').withAttributes({ mayCreateResource: true, mayWriteField: true }).withRelated('who', everyone);
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
    factory.addResource('grants').withAttributes({ mayUpdateResource: true, mayWriteField: true }).withRelated('who', everyone);
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
    factory.addResource('grants').withAttributes({ mayUpdateResource: true, mayWriteField: true })
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
    factory.addResource('grants').withAttributes({ mayUpdateResource: true, mayWriteField: true })
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
