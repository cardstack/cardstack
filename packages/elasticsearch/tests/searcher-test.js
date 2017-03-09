const Searcher = require('@cardstack/elasticsearch/searcher');
const { addRecords, deleteAllRecords } = require('@cardstack/server/tests/add-records');
const SchemaCache = require('@cardstack/server/schema-cache');
const { uniq } = require('lodash');

describe('searcher', function() {

  let searcher;
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
    searcher = new Searcher(new SchemaCache());
    let records = fixtures.slice();
    for (let i = 10; i < 30; i++) {
      records.push({
        type: 'comments',
        id: String(i),
        attributes: {
          body: `comment ${i}`
        }
      });
    }
    await addRecords(records);
  });

  after(async function() {
    await deleteAllRecords();
  });

  it('can be searched for all content', async function() {
    let { models } = await searcher.search('master', {
      page: { size: 1000 }
    });
    expect(models).to.have.length(fixtures.length + 20);
  });

  it('can be searched via queryString', async function() {
    let { models } = await searcher.search('master', {
      queryString: 'magic'
    });
    expect(models).to.have.length(1);
    expect(models).includes.something.with.deep.property('attributes.hello', 'magic words');
  });

  it('can be searched via queryString, negative result', async function() {
    let { models } = await searcher.search('master', {
      queryString: 'this-is-an-unused-term'
    });
    expect(models).to.have.length(0);
  });

  it('can filter by type', async function() {
    let { models } = await searcher.search('master', {
      filter: {
        type: 'articles'
      }
    });
    expect(models).to.have.length(1);
    expect(models).includes.something.with.deep.property('attributes.hello', 'magic words');
  });

  it('can filter by id', async function() {
    let { models } = await searcher.search('master', {
      filter: {
        id: '1'
      }
    });
    expect(models).to.have.length(2);
    expect(models).includes.something.with.property('type', 'articles');
    expect(models).includes.something.with.property('type', 'people');
  });

  it('can filter a field by one term', async function() {
    let { models } = await searcher.search('master', {
      filter: {
        firstName: 'Quint'
      }
    });
    expect(models).to.have.length(1);
    expect(models).includes.something.with.deep.property('attributes.firstName', 'Quint');
  });

  it('can filter a field by multiple terms', async function() {
    let { models } = await searcher.search('master', {
      filter: {
        firstName: ['Quint', 'Arthur']
      }
    });
    expect(models).to.have.length(2);
  });

  it('can use OR expressions in filters', async function() {
    let { models } = await searcher.search('master', {
      filter: {
        or: [
          { firstName: ['Quint'], type: 'people' },
          { type: 'articles', id: '1' }
        ]
      }
    });
    expect(models).to.have.length(2);
    expect(models).includes.something.with.deep.property('attributes.firstName', 'Quint');
    expect(models).includes.something.with.deep.property('type', 'articles');
  });

  it('can use AND expressions in filters', async function() {
    let { models } = await searcher.search('master', {
      filter: {
        and: [
          { color: 'red' },
          { type: 'people' }
        ]
      }
    });
    expect(models).to.have.length(1);
    expect(models).includes.something.with.deep.property('attributes.firstName', 'Arthur');
  });


  it('can filter by range', async function() {
    let { models } = await searcher.search('master', {
      filter: {
        age: {
          range: {
            lt: '2'
          }
        }
      }
    });
    expect(models).to.have.length(1);
    expect(models).includes.something.with.deep.property('attributes.firstName', 'Arthur');
  });

  it('can filter by field existence (string)', async function() {
    let { models } = await searcher.search('master', {
      filter: {
        color: {
          exists: 'true'
        },
        type: 'people'
      }
    });
    expect(models).to.have.length(1);
    expect(models).includes.something.with.deep.property('attributes.firstName', 'Arthur');
  });

  it('can filter by field nonexistence (string)', async function() {
    let { models } = await searcher.search('master', {
      filter: {
        color: {
          exists: 'false'
        },
        type: 'people'
      }
    });
    expect(models).to.have.length(1);
    expect(models).includes.something.with.deep.property('attributes.firstName', 'Quint' );
  });

  it('can filter by field existence (bool)', async function() {
    let { models } = await searcher.search('master', {
      filter: {
        color: {
          exists: true
        },
        type: 'people'
      }
    });
    expect(models).to.have.length(1);
    expect(models).includes.something.with.deep.property('attributes.firstName', 'Arthur');
  });

  it('can filter by field nonexistence (bool)', async function() {
    let { models } = await searcher.search('master', {
      filter: {
        color: {
          exists: false
        },
        type: 'people'
      }
    });
    expect(models).to.have.length(1);
    expect(models).includes.something.with.deep.property('attributes.firstName', 'Quint' );
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
    let { models } = await searcher.search('master', {
      filter: {
        type: 'people'
      },
      sort: 'age'
    });
    expect(models.map(r => r.attributes.firstName)).to.deep.equal(['Arthur', 'Quint']);
  });


  it('can sort reverse', async function() {
    let { models } = await searcher.search('master', {
      filter: {
        type: 'people'
      },
      sort: '-age'
    });
    expect(models.map(r => r.attributes.firstName)).to.deep.equal(['Quint', 'Arthur']);
  });

  it('can sort via field-specific mappings', async function() {
    // string fields are only sortable because of the sortFieldName
    // in @cardstack/core-field-types/string. So this is a test that
    // we're using that capability.
    let { models } = await searcher.search('master', {
      filter: {
        type: 'people'
      },
      sort: 'firstName'
    });
    expect(models.map(r => r.attributes.firstName)).to.deep.equal(['Arthur', 'Quint']);
  });


  it('can sort reverse via field-specific mappings', async function() {
    // string fields are only sortable because of the sortFieldName
    // in @cardstack/core-field-types/string. So this is a test that
    // we're using that capability.
    let { models } = await searcher.search('master', {
      filter: {
        type: 'people'
      },
      sort: '-firstName'
    });
    expect(models.map(r => r.attributes.firstName)).to.deep.equal(['Quint', 'Arthur']);
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

  it('can paginate', async function() {
    let response = await searcher.search('master', {
      filter: { type: 'comments' },
      page: {
        size: 7
      }
    });
    expect(response.models).length(7);
    expect(response.page).has.property('total', 20);
    expect(response.page).has.property('cursor');

    let allModels = response.models;

    response = await searcher.search('master', {
      filter: { type: 'comments' },
      page: {
        size: 7,
        cursor: response.page.cursor
      }
    });

    expect(response.models).length(7);
    expect(response.page).has.property('total', 20);
    expect(response.page).has.property('cursor');

    allModels = allModels.concat(response.models);

    response = await searcher.search('master', {
      filter: { type: 'comments' },
      page: {
        size: 7,
        cursor: response.page.cursor
      }
    });

    expect(response.models).length(6);
    expect(response.page).has.property('total', 20);
    expect(response.page).not.has.property('cursor');

    allModels = allModels.concat(response.models);

    expect(uniq(allModels.map(m => m.id))).length(20);
  });

});
