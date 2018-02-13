/*
  Our npm package cannot depend on @cardstack/test-support
  because @cardstack/test-support depends on us. Instead, for our
  tests we have a separate "test-app" that holds our devDependencies.
*/

const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('../../../tests/elasticsearch-test-app/node_modules/@cardstack/test-support/env');

const Factory = require('../../../tests/elasticsearch-test-app/node_modules/@cardstack/test-support/jsonapi-factory');

const { uniq } = require('lodash');

describe('elasticsearch/searcher', function() {

  let searcher, env, factory;

  before(async function() {
    this.timeout(2500);
    factory = new Factory();

    factory.addResource('content-types', 'people').withRelated('fields', [
      factory.addResource('fields', 'first-name').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
      factory.addResource('fields', 'last-name').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
      factory.addResource('fields', 'age').withAttributes({
        fieldType: '@cardstack/core-types::integer'
      }),
      factory.addResource('fields', 'favorite-color').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
      factory.addResource('fields', 'description').withAttributes({
        fieldType: '@cardstack/mobiledoc'
      }),
    ]);


    factory.addResource('content-types', 'articles').withRelated('fields', [
      factory.addResource('fields', 'title').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
      factory.getResource('fields', 'favorite-color'),
      factory.addResource('fields', 'hello').withAttributes({
        fieldType: '@cardstack/core-types::string'
      })
    ]);

    factory.addResource('content-types', 'comments').withRelated('fields', [
      factory.addResource('fields', 'body').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
      factory.addResource('fields', 'article').withAttributes({
        fieldType: '@cardstack/core-types::belongs-to'
      }).withRelated('related-types', [ factory.getResource('content-types', 'articles') ]),
      factory.addResource('fields', 'searchable-article').withAttributes({
        fieldType: '@cardstack/core-types::belongs-to'
      }).withRelated('related-types', [ factory.getResource('content-types', 'articles') ])
    ]).withAttributes({
      defaultIncludes: ['searchable-article']
    });

    factory.addResource('articles', '1').withAttributes({
      hello: 'magic words',
      favoriteColor: 'red'
    });

    factory.addResource('articles', '2').withAttributes({
      hello: 'this is article two'
    });


    factory.addResource('people', '1').withAttributes({
      firstName: 'Quint',
      lastName: 'Faulkner',
      age: 6,
      description: {
        version: "0.3.1",
        markups: [],
        atoms: [],
        cards: [],
        sections: [
          [1, "p", [
            [0, [], 0, "The quick brown fox jumps over the lazy dog."]
          ]]
        ]
      }
    });

    factory.addResource('people', '2').withAttributes({
      firstName: 'Arthur',
      lastName: 'Faulkner',
      age: 1,
      favoriteColor: 'red'
    });

    for (let i = 0; i < 20; i++) {
      let comment = factory.addResource('comments');
      comment.withAttributes({
        body: `comment ${comment.id}`
      });
      if (i < 4) {
        comment
          .withRelated('article', factory.getResource('articles', '1'))
          .withRelated('searchable-article', factory.getResource('articles', '1'));
      }
      if (i >=4 && i < 6) {
        comment
          .withRelated('article', factory.getResource('articles', '2'))
          .withRelated('searchable-article', factory.getResource('articles', '2'));
      }
    }

    factory.addResource('content-types', 'teams').withRelated('fields', [
      factory.addResource('fields', 'members').withAttributes({
        fieldType: '@cardstack/core-types::has-many'
      }).withRelated('related-types', [factory.getResource('content-types', 'people')]),
      factory.addResource('fields', 'searchable-members').withAttributes({
        fieldType: '@cardstack/core-types::has-many'
      }).withRelated('related-types', [factory.getResource('content-types', 'people')])
    ]).withAttributes({
      defaultIncludes: ['searchable-members']
    });

    factory.addResource('teams').withRelated('members', [
      factory.getResource('people', '1'),
      factory.getResource('people', '2')
    ]).withRelated('searchable-members', [
      factory.getResource('people', '1'),
      factory.getResource('people', '2')
    ]);

    env = await createDefaultEnvironment(`${__dirname}/../../../tests/elasticsearch-test-app`, factory.getModels());
    searcher = env.lookup('hub:searchers');
  });

  after(async function() {
    await destroyDefaultEnvironment(env);
  });

  it('can be searched for all content', async function() {
    let { data: models } = await searcher.search(env.session, 'master', {
      page: { size: 1000 }
    });
    expect(models.filter(m => m.type === 'comments')).to.have.length(20);
    expect(models.filter(m => m.type === 'people')).to.have.length(2);
    expect(models.filter(m => m.type === 'articles')).to.have.length(2);
  });

  it('returns properly formatted records', async function() {
    let model = (await searcher.get(env.session, 'master', 'people', '1')).data;
    let meta = model.meta;
    expect(Object.keys(meta).sort()).deep.equals(['version']);
    delete model.meta;
    expect(model).deep.equals({
      type: 'people',
      id: '1',
      attributes: {
        'first-name': 'Quint',
        'last-name': 'Faulkner',
        'favorite-color': null,
        age: 6,
        description: {
          version: "0.3.1",
          markups: [],
          atoms: [],
          cards: [],
          sections: [
            [1, "p", [
              [0, [], 0, "The quick brown fox jumps over the lazy dog."]
            ]]
          ]
        }
      }
    });
  });

  it('can be searched via queryString', async function() {
    let { data: models } = await searcher.search(env.session, 'master', {
      queryString: 'magic'
    });
    expect(models.filter(m => m.type === 'articles')).to.have.length(1);
    expect(models).includes.something.with.deep.property('attributes.hello', 'magic words');
    expect(models.filter(m => m.type === 'comments')).to.have.length(4);
  });

  it('can be searched via queryString, negative result', async function() {
    let { data: models } = await searcher.search(env.session, 'master', {
      queryString: 'thisisanunusedterm'
    });
    expect(models).to.have.length(0);
  });

  it('can filter by type', async function() {
    let { data: models } = await searcher.search(env.session, 'master', {
      filter: {
        type: 'articles'
      }
    });
    expect(models).to.have.length(2);
    expect(models).includes.something.with.deep.property('attributes.hello', 'magic words');
  });

  it('can sort by type', async function() {
    let { data: models } = await searcher.search(env.session, 'master', {
      filter: {
        type: ['articles', 'people']
      },
      sort: 'type'
    });
    expect(models).to.have.length(4);
    expect(models.map(m => m.type)).deep.equals(['articles', 'articles', 'people', 'people']);
  });

  it('can sort by type in reverse', async function() {
    let { data: models } = await searcher.search(env.session, 'master', {
      filter: {
        type: ['articles', 'people']
      },
      sort: '-type'
    });
    expect(models).to.have.length(4);
    expect(models.map(m => m.type)).deep.equals(['people', 'people', 'articles', 'articles']);
  });


  it('can filter by id', async function() {
    let { data: models } = await searcher.search(env.session, 'master', {
      filter: {
        id: '1',
        type: ['articles', 'people']
      }
    });
    expect(models).to.have.length(2);
    expect(models).includes.something.with.property('type', 'articles');
    expect(models).includes.something.with.property('type', 'people');
  });

  it('can sort by id', async function() {
    let { data: models } = await searcher.search(env.session, 'master', {
      filter: {
        type: ['articles', 'people']
      },
      sort: 'id'
    });
    expect(models.map(m => m.id)).deep.equals(['1', '1', '2', '2']);
  });

  it('can sort by id in reverse', async function() {
    let { data: models } = await searcher.search(env.session, 'master', {
      filter: {
        type: ['articles', 'people']
      },
      sort: '-id'
    });
    expect(models.map(m => m.id)).deep.equals(['2', '2', '1', '1']);
  });


  it('can filter a field by one term', async function() {
    let { data: models } = await searcher.search(env.session, 'master', {
      filter: {
        'first-name': 'Quint'
      }
    });
    expect(models).to.have.length(1);
    expect(models).includes.something.with.deep.property('attributes.first-name', 'Quint');
  });

  it('can filter a field by multiple terms', async function() {
    let { data: models } = await searcher.search(env.session, 'master', {
      filter: {
        'first-name': ['Quint', 'Arthur']
      }
    });
    expect(models).to.have.length(2);
  });

  it('can use OR expressions in filters', async function() {
    let { data: models } = await searcher.search(env.session, 'master', {
      filter: {
        or: [
          { 'first-name': ['Quint'], type: 'people' },
          { type: 'articles', id: '1' }
        ]
      }
    });
    expect(models).to.have.length(2);
    expect(models).includes.something.with.deep.property('attributes.first-name', 'Quint');
    expect(models).includes.something.with.deep.property('type', 'articles');
  });

  it('can use AND expressions in filters', async function() {
    let { data: models } = await searcher.search(env.session, 'master', {
      filter: {
        and: [
          { 'favorite-color': 'red' },
          { type: 'people' }
        ]
      }
    });
    expect(models).to.have.length(1);
    expect(models).includes.something.with.deep.property('attributes.first-name', 'Arthur');
  });


  it('can filter by range', async function() {
    let { data: models } = await searcher.search(env.session, 'master', {
      filter: {
        age: {
          range: {
            lt: '2'
          }
        }
      }
    });
    expect(models).to.have.length(1);
    expect(models).includes.something.with.deep.property('attributes.first-name', 'Arthur');
  });

  it('can filter by field existence (string)', async function() {
    let { data: models } = await searcher.search(env.session, 'master', {
      filter: {
        'favorite-color': {
          exists: 'true'
        },
        type: 'people'
      }
    });
    expect(models).to.have.length(1);
    expect(models).includes.something.with.deep.property('attributes.first-name', 'Arthur');
  });

  it('can filter by field nonexistence (string)', async function() {
    let { data: models } = await searcher.search(env.session, 'master', {
      filter: {
        'favorite-color': {
          exists: 'false'
        },
        type: 'people'
      }
    });
    expect(models).to.have.length(1);
    expect(models).includes.something.with.deep.property('attributes.first-name', 'Quint' );
  });

  it('can filter by field existence (bool)', async function() {
    let { data: models } = await searcher.search(env.session, 'master', {
      filter: {
        'favorite-color': {
          exists: true
        },
        type: 'people'
      }
    });
    expect(models).to.have.length(1);
    expect(models).includes.something.with.deep.property('attributes.first-name', 'Arthur');
  });

  it('can filter by field nonexistence (bool)', async function() {
    let { data: models } = await searcher.search(env.session, 'master', {
      filter: {
        'favorite-color': {
          exists: false
        },
        type: 'people'
      }
    });
    expect(models).to.have.length(1);
    expect(models).includes.something.with.deep.property('attributes.first-name', 'Quint' );
  });

  it('can search within a field with custom indexing behavior', async function() {
    let { data: models } = await searcher.search(env.session, 'master', {
      filter: {
        description: 'fox'
      }
    });
    expect(models).to.have.length(1);
    expect(models).has.deep.property('[0].attributes.first-name', 'Quint');

    // These are the internally used fields that should not leak out
    expect(models[0].attributes).has.not.property('cardstack_derived_names');
    expect(models[0].attributes).has.not.property('description_as_text');
  });

  it('gives helpful error when filtering unknown field', async function() {
    try {
      await searcher.search(env.session, 'master', {
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
    let { data: models } = await searcher.search(env.session, 'master', {
      filter: {
        type: 'people'
      },
      sort: 'age'
    });
    expect(models.map(r => r.attributes['first-name'])).to.deep.equal(['Arthur', 'Quint']);
  });


  it('can sort reverse', async function() {
    let { data: models } = await searcher.search(env.session, 'master', {
      filter: {
        type: 'people'
      },
      sort: '-age'
    });
    expect(models.map(r => r.attributes['first-name'])).to.deep.equal(['Quint', 'Arthur']);
  });

  it('can sort via field-specific mappings', async function() {
    // string fields are only sortable because of the sortFieldName
    // in @cardstack/core-field-types/string. So this is a test that
    // we're using that capability.
    let { data: models } = await searcher.search(env.session, 'master', {
      filter: {
        type: 'people'
      },
      sort: 'first-name'
    });
    expect(models.map(r => r.attributes['first-name'])).to.deep.equal(['Arthur', 'Quint']);
  });


  it('can sort reverse via field-specific mappings', async function() {
    // string fields are only sortable because of the sortFieldName
    // in @cardstack/core-field-types/string. So this is a test that
    // we're using that capability.
    let { data: models } = await searcher.search(env.session, 'master', {
      filter: {
        type: 'people'
      },
      sort: '-first-name'
    });
    expect(models.map(r => r.attributes['first-name'])).to.deep.equal(['Quint', 'Arthur']);
  });

  it('has helpful error when sorting by nonexistent field', async function() {
    try {
      await searcher.search(env.session, 'master', {
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
    let response = await searcher.search(env.session, 'master', {
      filter: { type: 'comments' },
      page: {
        size: 7
      }
    });
    expect(response.data).length(7);
    expect(response.meta.page).has.property('total', 20);
    expect(response.meta.page).has.property('cursor');

    let allModels = response.data;

    response = await searcher.search(env.session, 'master', {
      filter: { type: 'comments' },
      page: {
        size: 7,
        cursor: response.meta.page.cursor
      }
    });

    expect(response.data).length(7);
    expect(response.meta.page).has.property('total', 20);
    expect(response.meta.page).has.property('cursor');

    allModels = allModels.concat(response.data);

    response = await searcher.search(env.session, 'master', {
      filter: { type: 'comments' },
      page: {
        size: 7,
        cursor: response.meta.page.cursor
      }
    });

    expect(response.data).length(6);
    expect(response.meta.page).has.property('total', 20);
    expect(response.meta.page).not.has.property('cursor');

    allModels = allModels.concat(response.data);

    expect(uniq(allModels.map(m => m.id))).length(20);
  });

  it('can paginate when results exactly fill final page', async function() {
    let response = await searcher.search(env.session, 'master', {
      filter: { type: 'comments' },
      page: {
        size: 10
      }
    });
    expect(response.data).length(10);
    expect(response.meta.page).has.property('total', 20);
    expect(response.meta.page).has.property('cursor');

    let allModels = response.data;

    response = await searcher.search(env.session, 'master', {
      filter: { type: 'comments' },
      page: {
        size: 10,
        cursor: response.meta.page.cursor
      }
    });

    expect(response.data).length(10);
    expect(response.meta.page).has.property('total', 20);
    expect(response.meta.page).not.has.property('cursor');

    allModels = allModels.concat(response.data);
    expect(uniq(allModels.map(m => m.id))).length(20);
  });

  it('can get an individual record', async function() {
    let model = await searcher.get(env.session, 'master', 'articles', '1');
    expect(model).has.deep.property('data.attributes.hello', 'magic words');
  });

  it('can do analyzed term matching', async function() {
    let response = await searcher.search(env.session, 'master', {
      filter: {
        hello: 'magic'
      }
    });
    expect(response.data).length(1);
    expect(response.data[0]).has.deep.property('attributes.hello', 'magic words');
  });

  it('matches reordered phrase when using analyzed field', async function() {
    let response = await searcher.search(env.session, 'master', {
      filter: {
        hello: 'words magic'
      }
    });
    expect(response.data).length(1);
  });

  it('does not match reordered phrase when using exact field', async function() {
    let response = await searcher.search(env.session, 'master', {
      filter: {
        hello: { exact: 'words magic' }
      }
    });
    expect(response.data).length(0);
  });


  it('can do exact term matching with a phrase', async function() {
    let response = await searcher.search(env.session, 'master', {
      filter: {
        hello: { exact: 'magic words' }
      }
    });
    expect(response.data).length(1);
    expect(response.data[0]).has.deep.property('attributes.hello', 'magic words');
  });

  it('incomplete phrase does not match', async function() {
    let response = await searcher.search(env.session, 'master', {
      filter: {
        hello: { exact: 'magic words extra' }
      }
    });
    expect(response.data).length(0);
  });


  it('can do exact term matching with multiple phrases', async function() {
    let response = await searcher.search(env.session, 'master', {
      filter: {
        hello: { exact: ['something else', 'magic words'] }
      }
    });
    expect(response.data).length(1);
    expect(response.data[0]).has.deep.property('attributes.hello', 'magic words');
  });

  it('can filter non-searchable belongsTo by id', async function() {
    let response = await searcher.search(env.session, 'master', {
      filter: {
        'article.id': { exact: '1' }
      }
    });
    expect(response.data).length(4);
  });

  it('can filter searchable belongsTo by id', async function() {
    let response = await searcher.search(env.session, 'master', {
      filter: {
        'searchable-article.id': { exact: '1' }
      }
    });
    expect(response.data).length(4);
  });

  it('can filter non-searchable belongsTo by multiple ids', async function() {
    let response = await searcher.search(env.session, 'master', {
      filter: {
        'article.id': { exact: ['1', '2'] }
      }
    });
    expect(response.data).length(6);
  });

  it('can filter searchable belongsTo by multiple ids', async function() {
    let response = await searcher.search(env.session, 'master', {
      filter: {
        'searchable-article.id': { exact: ['1', '2'] }
      }
    });
    expect(response.data).length(6);
  });

  it('can filter non-searchable hasMany by id', async function() {
    let response = await searcher.search(env.session, 'master', {
      filter: {
        'members.id': { exact: '1' }
      }
    });
    expect(response.data).length(1);
  });

  it('can filter searchable hasMany by id', async function() {
    let response = await searcher.search(env.session, 'master', {
      filter: {
        'searchable-members.id': { exact: '1' }
      }
    });
    expect(response.data).length(1);
  });

  it('can filter non-searchable hasMany by multiple id', async function() {
    let response = await searcher.search(env.session, 'master', {
      filter: {
        'members.id': { exact: ['1', 'bogus'] }
      }
    });
    expect(response.data).length(1);
  });

  it('can filter searchable hasMany by multiple id', async function() {
    let response = await searcher.search(env.session, 'master', {
      filter: {
        'searchable-members.id': { exact: ['1', 'bogus'] }
      }
    });
    expect(response.data).length(1);
  });

  it('belongs-to attributes are not indexed by default', async function() {
    let response = await searcher.search(env.session, 'master', {
      filter: {
        'article.hello': 'magic'
      }
    });
    expect(response.data).length(0);
  });

  it('can filter searchable belongs-to by an attribute', async function() {
    let response = await searcher.search(env.session, 'master', {
      filter: {
        'searchable-article.hello': 'magic'
      }
    });
    expect(response.data).length(4);
  });

  it('hasMany attributes are not indexed by default', async function() {
    let response = await searcher.search(env.session, 'master', {
      filter: {
        'members.first-name': 'Quint'
      }
    });
    expect(response.data).length(0);
  });

  it('can filter searchable has-many by an attribute', async function() {
    let response = await searcher.search(env.session, 'master', {
      filter: {
        'searchable-members.first-name': 'Quint'
      }
    });
    expect(response.data).length(1);
  });

  it('can do prefix matching', async function() {
    let { data: models } = await searcher.search(env.session, 'master', {
      filter: {
        'last-name': {
          prefix: 'Faulk'
        }
      }
    });
    expect(models).length(2);
    expect(models).includes.something.with.deep.property('attributes.first-name', 'Quint' );
    expect(models).includes.something.with.deep.property('attributes.first-name', 'Arthur' );
  });
});
