const Schema = require('@cardstack/server/schema');
const Searcher = require('@cardstack/elasticsearch/searcher');
const addRecords = require('@cardstack/server/tests/add-records');
const ElasticAssert = require('@cardstack/data-source/tests/elastic-assertions');

describe('schema', function() {

  let schema;

  before(async function() {
    await addRecords([
      { type: 'content-types', id: 'articles' }
    ]);

    let searcher = new Searcher();
    schema = await Schema.loadFrom(searcher, 'master');
  });

  after(async function() {
    let ea = new ElasticAssert();
    await ea.deleteAllIndices();
  });

  it("rejects unknown type", async function() {
    expect(schema.validationErrors({
      type: 'unicorns',
      id: '1'
    })).includes.something.with.property('detail', '"unicorns" is not a valid type');
  });

  it("accepts known types", async function() {
    expect(schema.validationErrors({
      type: 'articles',
      id: '1'
    })).to.deep.equal([]);
  });
});
