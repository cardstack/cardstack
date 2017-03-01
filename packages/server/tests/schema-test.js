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
              { type: 'fields', id: 'title' },
              { type: 'fields', id: 'published-date' }
            ]
          }
        }
      },
      {
        type: 'fields',
        id: 'title',
        attributes: {
          'field-type': 'string'
        }
      },
      {
        type: 'fields',
        id: 'published-date',
        attributes: {
          'field-type': 'date'
        }
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

  it("accepts known fields", async function() {
    expect(await schema.validationErrors({
      type: 'articles',
      id: '1',
      attributes: {
        title: "hello world",
        "published-date": "2013-02-08 09:30:26.123+07:00"
      }
    })).deep.equals([]);
  });

  it("rejects badly formatted fields", async function() {
    let errors = await schema.validationErrors({
      type: 'articles',
      id: '1',
      attributes: {
        title: 21,
        "published-date": "Not a date"
      }
    });
    expect(errors).includes.something.with.property('detail', '21 is not a valid value for field "title"');
    expect(errors).includes.something.with.property('detail', '"Not a date" is not a valid value for field "published-date"');
  });


});
