const temp = require('@cardstack/data-source/tests/temp-helper');
const Searcher = require('@cardstack/elasticsearch/searcher');
const ElasticAssert = require('@cardstack/data-source/tests/elastic-assertions');

// These are test-only dependencies.
const Indexer = require('@cardstack/git/indexer');
const { makeRepo } = require('@cardstack/git/tests/support');

describe('searcher', function() {

  let root, searcher, ea;
  let fixtures = [
    {
      type: 'articles',
      id: '1',
      content: {
        hello: 'magic words'
      }
    },
    {
      type: 'people',
      id: '1',
      content: {
        firstName: 'Quint',
        lastName: 'Faulkner',
        age: 6
      }
    },
    {
      type: 'people',
      id: '2',
      content: {
        firstName: 'Arthur',
        lastName: 'Faulkner',
        age: 1
      }
    }
  ];

  before(async function() {
    ea = new ElasticAssert();
    root = await temp.mkdir('cardstack-server-test');
    let indexer = new Indexer({
      repoPath: root
    });
    searcher = new Searcher();

    await makeRepo(root, [
      {
        changes: fixtures.map(f => ({
          operation: 'create',
          filename: `contents/${f.type}/${f.id}.json`,
          buffer: Buffer.from(JSON.stringify(f.content), 'utf8')
        }))
      }
    ]);
    await indexer.update({ realTime: true });
  });

  after(async function() {
    await temp.cleanup();
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
    expect(results).includes.something.with.deep.property('document.hello', 'magic words');
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
    expect(results).includes.something.with.deep.property('document.hello', 'magic words');
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
    expect(results).includes.something.with.deep.property('document.firstName', 'Quint');
  });

  it('can filter a field by multiple terms', async function() {
    let results = await searcher.search('master', {
      filter: {
        firstName: ['Quint', 'Arthur']
      }
    });
    expect(results).to.have.length(2);
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
    expect(results).includes.something.with.deep.property('document.firstName', 'Arthur');
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


});
