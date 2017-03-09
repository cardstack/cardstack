const Searcher = require('@cardstack/elasticsearch/searcher');
const ElasticAssert = require('@cardstack/elasticsearch/tests/assertions');
const addRecords = require('@cardstack/server/tests/add-records');
const SchemaCache = require('@cardstack/server/schema-cache');

describe('searcher', function() {

  let searcher, ea;
  let fixtures = [
    {
      type: 'content-types',
      id: 'people',
      relationships: {
        fields: {
          data: [
            { type: 'fields', id: 'firstName' },
            { type: 'fields', id: 'lastName' },
            { type: 'fields', id: 'age' },
            { type: 'fields', id: 'color' }
          ]
        }
      }
    },
    {
      type: 'content-types',
      id: 'articles',
      relationships: {
        fields: {
          data: [
            { type: 'fields', id: 'title' },
            { type: 'fields', id: 'color' }
          ]
        }
      }
    },
    {
      type: 'fields',
      id: 'firstName',
      attributes: {
        'field-type': 'string'
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
      id: 'color',
      attributes: {
        'field-type': 'string'
      }
    },
    {
      type: 'fields',
      id: 'lastName',
      attributes: {
        'field-type': 'string'
      }
    },
    {
      type: 'fields',
      id: 'age',
      attributes: {
        'field-type': 'integer'
      }
    },
    {
      type: 'articles',
      id: '1',
      attributes: {
        hello: 'magic words',
        color: 'red',
      }
    },
    {
      type: 'people',
      id: '1',
      attributes: {
        firstName: 'Quint',
        lastName: 'Faulkner',
        age: 6
      }
    },
    {
      type: 'people',
      id: '2',
      attributes: {
        firstName: 'Arthur',
        lastName: 'Faulkner',
        age: 1,
        color: 'red'
      }
    }
  ];

  before(async function() {
    ea = new ElasticAssert();
    searcher = new Searcher(new SchemaCache());
    await addRecords(fixtures);
  });

  after(async function() {
    await ea.deleteAllIndices();
  });


  it('can be searched for all content', async function() {
    let results = await searcher.search('master', {});
    expect(results).to.have.length(fixtures.length);
  });

  it('can be searched via queryString', async function() {
    let results = await searcher.search('master', {
      queryString: 'magic'
    });
    expect(results).to.have.length(1);
    expect(results).includes.something.with.deep.property('attributes.hello', 'magic words');
  });

  it('can be searched via queryString, negative result', async function() {
    let results = await searcher.search('master', {
      queryString: 'this-is-an-unused-term'
    });
    expect(results).to.have.length(0);
  });

  it('can filter by type', async function() {
    let results = await searcher.search('master', {
      filter: {
        type: 'articles'
      }
    });
    expect(results).to.have.length(1);
    expect(results).includes.something.with.deep.property('attributes.hello', 'magic words');
  });

  it('can filter by id', async function() {
    let results = await searcher.search('master', {
      filter: {
        id: '1'
      }
    });
    expect(results).to.have.length(2);
    expect(results).includes.something.with.property('type', 'articles');
    expect(results).includes.something.with.property('type', 'people');
  });

  it('can filter a field by one term', async function() {
    let results = await searcher.search('master', {
      filter: {
        firstName: 'Quint'
      }
    });
    expect(results).to.have.length(1);
    expect(results).includes.something.with.deep.property('attributes.firstName', 'Quint');
  });

  it('can filter a field by multiple terms', async function() {
    let results = await searcher.search('master', {
      filter: {
        firstName: ['Quint', 'Arthur']
      }
    });
    expect(results).to.have.length(2);
  });

  it('can use OR expressions in filters', async function() {
    let results = await searcher.search('master', {
      filter: {
        or: [
          { firstName: ['Quint'], type: 'people' },
          { type: 'articles', id: '1' }
        ]
      }
    });
    expect(results).to.have.length(2);
    expect(results).includes.something.with.deep.property('attributes.firstName', 'Quint');
    expect(results).includes.something.with.deep.property('type', 'articles');
  });

  it('can use AND expressions in filters', async function() {
    let results = await searcher.search('master', {
      filter: {
        and: [
          { color: 'red' },
          { type: 'people' }
        ]
      }
    });
    expect(results).to.have.length(1);
    expect(results).includes.something.with.deep.property('attributes.firstName', 'Arthur');
  });


  it('can filter by range', async function() {
    let results = await searcher.search('master', {
      filter: {
        age: {
          range: {
            lt: '2'
          }
        }
      }
    });
    expect(results).to.have.length(1);
    expect(results).includes.something.with.deep.property('attributes.firstName', 'Arthur');
  });

  it('can filter by field existence (string)', async function() {
    let results = await searcher.search('master', {
      filter: {
        age: {
          exists: 'true'
        }
      }
    });
    expect(results).to.have.length(2);
  });

  it('can filter by field nonexistence (string)', async function() {
    let results = await searcher.search('master', {
      filter: {
        age: {
          exists: 'false'
        }
      }
    });
    expect(results).to.have.length(fixtures.length - 2);
  });

  it('can filter by field existence (bool)', async function() {
    let results = await searcher.search('master', {
      filter: {
        age: {
          exists: true
        }
      }
    });
    expect(results).to.have.length(2);
  });

  it('can filter by field nonexistence (bool)', async function() {
    let results = await searcher.search('master', {
      filter: {
        age: {
          exists: false
        }
      }
    });
    expect(results).to.have.length(fixtures.length - 2);
  });

  it('gives helpful error when filtering unknown field', async function() {
    try {
      await searcher.search('master', {
        filter: {
          flavor: 'chocolate'
        }
      });
      throw new Error("should not get here");
    } catch (err) {
      if (!err.status) {
        throw err;
      }
      expect(err.status).equals(400);
      expect(err.detail).equals('Cannot filter by unknown field "flavor"');
    }
  });

  it('can sort', async function() {
    let results = await searcher.search('master', {
      filter: {
        type: 'people'
      },
      sort: 'age'
    });
    expect(results.map(r => r.attributes.firstName)).to.deep.equal(['Arthur', 'Quint']);
  });


  it('can sort reverse', async function() {
    let results = await searcher.search('master', {
      filter: {
        type: 'people'
      },
      sort: '-age'
    });
    expect(results.map(r => r.attributes.firstName)).to.deep.equal(['Quint', 'Arthur']);
  });

  it('can sort via field-specific mappings', async function() {
    // string fields are only sortable because of the sortFieldName
    // in @cardstack/core-field-types/string. So this is a test that
    // we're using that capability.
    let results = await searcher.search('master', {
      filter: {
        type: 'people'
      },
      sort: 'firstName'
    });
    expect(results.map(r => r.attributes.firstName)).to.deep.equal(['Arthur', 'Quint']);
  });


  it('can sort reverse via field-specific mappings', async function() {
    // string fields are only sortable because of the sortFieldName
    // in @cardstack/core-field-types/string. So this is a test that
    // we're using that capability.
    let results = await searcher.search('master', {
      filter: {
        type: 'people'
      },
      sort: '-firstName'
    });
    expect(results.map(r => r.attributes.firstName)).to.deep.equal(['Quint', 'Arthur']);
  });

  it('has helpful error when sorting by nonexistent field', async function() {
    try {
      await searcher.search('master', {
        sort: 'something-that-does-not-exist'
      });
      throw new Error("should not get here");
    } catch (err) {
      if (!err.status) {
        throw err;
      }
      expect(err.status).equals(400);
      expect(err.detail).equals('Cannot sort by unknown field "something-that-does-not-exist"');
    }
  });

  it.skip('can paginate results', async function() {
    expect('unimplemented').to.equal('implemented');
  });

});
