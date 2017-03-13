const Schema = require('@cardstack/server/schema');
const ElasticAssert = require('@cardstack/elasticsearch/tests/assertions');

describe('schema/auth', function() {

  let schema;

  before(async function() {
    let models = [
      {
        type: 'content-types',
        id: 'articles',
        relationships: {
          fields: {
            data: [
              { type: 'fields', id: 'title' },
              { type: 'fields', id: 'published-date' }
            ]
          },
          'data-source': {
            data: { type: 'data-sources', id: '432' }
          }
        }
      },
      {
        type: 'fields',
        id: 'title',
        attributes: {
          'field-type': 'string'
        },
        relationships: {
          constraints: {
            data: [
              { type: 'constraints', id: '0' }
            ]
          }
        }
      },
      {
        type: 'fields',
        id: 'published-date',
        attributes: {
          'field-type': 'date',
          searchable: false
        },
        relationships: {
          constraints: {
            data: [
              { type: 'constraints', id: '1' }
            ]
          }
        }
      },
      {
        type: 'constraints',
        id: '0',
        attributes: {
          'constraint-type': 'length',
          parameters: {
            max: 40
          }
        }
      },
      {
        type: 'constraints',
        id: '1',
        attributes: {
          'constraint-type': 'not-null'
        }
      },
      {
        type: 'content-types',
        id: 'events',
        relationships: {
          fields: {
            data: [
              { type: 'fields', id: 'title' },
            ]
          }
        }
      },
      {
        type: 'data-sources',
        id: '432',
        attributes: {
          'source-type': 'git',
          params: {
            repo: 'http://example.git/repo.git'
          }
        }
      }
    ];
    schema = await Schema.loadFrom(models);
  });

  after(async function() {
    let ea = new ElasticAssert();
    await ea.deleteAllIndices();
  });

  it("forbids creation", async function() {
    expect(await schema.validationErrors(create({
      type: 'articles',
      id: '1'
    }))).collectionContains({
      status: 401,
      detail: 'You may not create this resource'
    });
  });

  it("forbids deletion", async function() {
    expect(await schema.validationErrors(deleteIt({
      type: 'articles',
      id: '1'
    }))).collectionContains({
      status: 401,
      detail: 'You may not delete this resource'
    });
  });

  it("forbids update", async function() {
    expect(await schema.validationErrors(update({
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
    }))).collectionContains({
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
