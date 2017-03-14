const Schema = require('@cardstack/server/schema');
const ElasticAssert = require('@cardstack/elasticsearch/tests/assertions');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

describe('schema/auth', function() {

  let factory;

  beforeEach(async function() {
    factory = new JSONAPIFactory();

    factory.addResource('content-types', 'articles')
      .withRelated('fields', [
        factory.addResource('fields', 'title')
          .withAttributes({ fieldType: 'string' }),
        factory.addResource('fields', 'published-date')
          .withAttributes({
            fieldType: 'date'
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

});

function create(document) {
  return {
    finalDocument: document,
    originalDocument: null
  };
}

function deleteIt(document) {
  return {
    finalDocument: null,
    originalDocument: document
  };
}

function update(older, newer) {
  return {
    finalDocument: newer,
    originalDocument: older
  };
}
