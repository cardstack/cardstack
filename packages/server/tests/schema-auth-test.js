const Schema = require('@cardstack/server/schema');
const ElasticAssert = require('@cardstack/elasticsearch/tests/assertions');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
const PendingChange = require('@cardstack/data-source/pending-change');

describe('schema/auth', function() {

  let factory;

  beforeEach(async function() {
    factory = new JSONAPIFactory();

    factory.addResource('content-types', 'articles')
      .withRelated('fields', [
        factory.addResource('fields', 'title')
          .withAttributes({ fieldType: 'string' }),
        factory.addResource('fields', 'coolness')
          .withAttributes({
            fieldType: 'integer',
            defaultValue: 0
          })
      ]);

    factory.addResource('content-types', 'events')
      .withRelated('fields', [
        factory.getResource('fields', 'title')
      ]);

  });

  afterEach(async function() {
    let ea = new ElasticAssert();
    await ea.deleteAllIndices();
  });

  it("forbids creation", async function() {
    let schema = await Schema.loadFrom(factory.getModels());
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

  it("unrestricted grant allows creation", async function() {
    factory.addResource('grants').withAttributes({ mayCreateResource: true });
    let schema = await Schema.loadFrom(factory.getModels());
    let action = create({
      type: 'articles',
      id: '1'
    });
    let errors = await schema.validationErrors(action);
    expect(errors).deep.equal([]);
  });

  it("user-specific grant allows creation", async function() {
    factory.addResource('grants').withAttributes({ mayCreateResource: true })
      .withRelated('who', { types: 'groups', id: '0' });
    let schema = await Schema.loadFrom(factory.getModels());
    let action = create({
      type: 'articles',
      id: '1'
    });
    let errors = await schema.validationErrors(action, { user: { id: 0 }});
    expect(errors).deep.equal([]);
  });

  it("user-specific grant doesn't match missing user", async function() {
    factory.addResource('grants').withAttributes({ mayCreateResource: true })
      .withRelated('who', { types: 'groups', id: '0' });
    let schema = await Schema.loadFrom(factory.getModels());
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
      .withRelated('who', { types: 'groups', id: '0' });
    let schema = await Schema.loadFrom(factory.getModels());
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
      .withRelated('types', [factory.getResource('content-types', 'articles')]);
    let schema = await Schema.loadFrom(factory.getModels());
    let action = create({
      type: 'articles',
      id: '1'
    });
    let errors = await schema.validationErrors(action);
    expect(errors).deep.equal([]);
  });

  it("forbids by type", async function() {
    factory.addResource('grants').withAttributes({ mayCreateResource: true })
      .withRelated('types', [factory.getResource('content-types', 'articles')]);
    let schema = await Schema.loadFrom(factory.getModels());
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
    let schema = await Schema.loadFrom(factory.getModels());
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
    let schema = await Schema.loadFrom(factory.getModels());
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

  it.skip("approves field write at creation via grant", async function () {
    factory.addResource('grants').withAttributes({ mayCreateResource: true, mayWriteField: true });
    let schema = await Schema.loadFrom(factory.getModels());
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

  it.skip("approves null field write at creation when no default is set", async function () {
    factory.addResource('grants').withAttributes({ mayCreateResource: true });
    let schema = await Schema.loadFrom(factory.getModels());
    let action = create({
      type: 'articles',
      id: '1',
      attributes: {
        title: null
      }
    });
    let errors = await schema.validationErrors(action);
    expect(errors).deep.equal([]);
  });

  it.skip("rejects null field write at creation when default is set", async function () {
    factory.addResource('grants').withAttributes({ mayCreateResource: true });
    let schema = await Schema.loadFrom(factory.getModels());
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


  it.skip("approves field write at creation when it matches default value", async function () {
    factory.addResource('grants').withAttributes({ mayCreateResource: true });
    let schema = await Schema.loadFrom(factory.getModels());
    let action = create({
      type: 'articles',
      id: '1',
      attributes: {
        coolness: 0
      }
    });
    let errors = await schema.validationErrors(action);
    expect(errors).to.deep.equal([]);
  });


  it("rejects field write at creation", async function () {
    factory.addResource('grants').withAttributes({ mayCreateResource: true });
    let schema = await Schema.loadFrom(factory.getModels());
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

  it.skip("approves field write at update via grant", async function () {

  });

  it.skip("approves field write at update via unchanged value", async function () {
    factory.addResource('grants').withAttributes({ mayUpdateResource: true });
    let schema = await Schema.loadFrom(factory.getModels());
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

  it.skip("rejects field write at update", async function () {
    factory.addResource('grants').withAttributes({ mayUpdateResource: true });
    let schema = await Schema.loadFrom(factory.getModels());
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
