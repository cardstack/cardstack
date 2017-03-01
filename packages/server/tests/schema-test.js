const Schema = require('@cardstack/server/schema');
const Searcher = require('@cardstack/elasticsearch/searcher');
const addRecords = require('@cardstack/server/tests/add-records');
const ElasticAssert = require('@cardstack/data-source/tests/elastic-assertions');

describe('schema', function() {

  let schema;

  before(async function() {
    await addRecords([
      {
        type: 'content-types',
        id: 'articles',
        relationships: {
          fields: {
            data: [
              { type: 'fields', id: 'title' }
            ]
          }
        }
      },
      {
        type: 'fields',
        id: 'title',
        attributes: {}
      }
    ]);

    let searcher = new Searcher();
    schema = await Schema.loadFrom(searcher, 'master');
  });

  after(async function() {
    let ea = new ElasticAssert();
    await ea.deleteAllIndices();
  });

  it("rejects unknown type", async function() {
    expect(await schema.validationErrors({
      type: 'unicorns',
      id: '1'
    })).includes.something.with.property('detail', '"unicorns" is not a valid type');
  });

  it("accepts known types", async function() {
    expect(await schema.validationErrors({
      type: 'articles',
      id: '1'
    })).to.deep.equal([]);
  });

  it("rejects unknown fields", async function() {
    let errors = await schema.validationErrors({
      type: 'articles',
      id: '1',
      attributes: {
        popularity: 100,
        pomposity: 'high'
      }
    });
    expect(errors).includes.something.with.property('detail', 'type "articles" has no field named "popularity"');
    expect(errors).includes.something.with.property('detail', 'type "articles" has no field named "pomposity"');
  });

  it("accepts known field", async function() {
    expect(await schema.validationErrors({
      type: 'articles',
      id: '1',
      attributes: {
        title: "hello world"
      }
    })).deep.equals([]);
  });

});
