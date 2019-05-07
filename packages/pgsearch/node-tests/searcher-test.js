/*
  Our npm package cannot depend on @cardstack/test-support
  because @cardstack/test-support depends on us. Instead, for our
  tests we have a separate "test-app" that holds our devDependencies.
*/

const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('../../../tests/pgsearch-test-app/node_modules/@cardstack/test-support/env');

const Factory = require('../../../tests/pgsearch-test-app/node_modules/@cardstack/test-support/jsonapi-factory');
const { addContextForCardDefinition, modelsOf } = require('@cardstack/plugin-utils/card-context');
const sourceId = 'local-hub';

const { uniq } = require('lodash');

describe('pgsearch/searcher', function () {

  let searcher, env;

  before(async function () {
    this.timeout(5000);

    let cards = [];
    let factory = new Factory();

    cards.push(addContextForCardDefinition(sourceId, 'person-card', factory.getDocumentFor(
      factory.addResource('card-definitions')
        .withRelated('model', factory.addResource('content-types')
          .withAttributes({ name: 'people' })
          .withRelated('fields', [
            factory.addResource('fields').withAttributes({
              name: 'first-name',
              'is-metadata': true,
              'needed-when-embedded': true,
              fieldType: '@cardstack/core-types::string'
            }),
            factory.addResource('fields').withAttributes({
              name: 'last-name',
              'is-metadata': true,
              'needed-when-embedded': true,
              fieldType: '@cardstack/core-types::string'
            }),
            factory.addResource('fields').withAttributes({
              name: 'age',
              'is-metadata': true,
              'needed-when-embedded': true,
              fieldType: '@cardstack/core-types::integer'
            }),
            factory.addResource('fields').withAttributes({
              name: 'favorite-shapes',
              'is-metadata': true,
              'needed-when-embedded': true,
              fieldType: '@cardstack/core-types::string-array'
            }),
            factory.addResource('fields').withAttributes({
              name: 'favorite-color',
              'is-metadata': true,
              'needed-when-embedded': true,
              fieldType: '@cardstack/core-types::string'
            }),
            factory.addResource('fields').withAttributes({
              name: 'description',
              'is-metadata': true,
              'needed-when-embedded': true,
              fieldType: '@cardstack/mobiledoc'
            }),
          ]))
    )));

    factory = new Factory();
    cards.push(addContextForCardDefinition(sourceId, 'article-card', factory.getDocumentFor(
      factory.addResource('card-definitions')
        .withRelated('model', factory.addResource('content-types')
          .withAttributes({ name: 'articles' })
          .withRelated('fields', [
            factory.addResource('fields').withAttributes({
              name: 'title',
              'is-metadata': true,
              'needed-when-embedded': true,
              fieldType: '@cardstack/core-types::string'
            }),
            factory.addResource('fields').withAttributes({
              name: 'favorite-color',
              'is-metadata': true,
              'needed-when-embedded': true,
              fieldType: '@cardstack/core-types::string'
            }),
            factory.addResource('fields').withAttributes({
              name: 'favorite-toy',
              'is-metadata': true,
              'needed-when-embedded': true,
              fieldType: '@cardstack/core-types::string'
            }),
            factory.addResource('fields').withAttributes({
              name: 'email-address',
              'is-metadata': true,
              'needed-when-embedded': true,
              fieldType: '@cardstack/core-types::case-insensitive'
            }),
            factory.addResource('fields').withAttributes({
              name: 'hello',
              'is-metadata': true,
              'needed-when-embedded': true,
              fieldType: '@cardstack/core-types::string'
            })
          ]))
    )));

    factory = new Factory();
    cards.push(addContextForCardDefinition(sourceId, 'comment-card', factory.getDocumentFor(
      factory.addResource('card-definitions')
        .withRelated('model', factory.addResource('content-types')
          .withAttributes({
            name: 'comments',
            defaultIncludes: ['searchable-article']
          })
          .withRelated('fields', [
            factory.addResource('fields').withAttributes({
              name: 'body',
              'is-metadata': true,
              'needed-when-embedded': true,
              fieldType: '@cardstack/core-types::string'
            }),
            factory.addResource('fields').withAttributes({
              name: 'score',
              'is-metadata': true,
              'needed-when-embedded': true,
              fieldType: '@cardstack/core-types::integer'
            }),
            factory.addResource('fields').withAttributes({
              name: 'article',
              'is-metadata': true,
              'needed-when-embedded': true, // TODO if this is not searchable, perhaps we should not be adding it when its embedded?
              fieldType: '@cardstack/core-types::belongs-to'
            }).withRelated('related-types', [{ type: 'content-types', id: 'cards' }]),
            factory.addResource('fields').withAttributes({
              name: 'searchable-article',
              'is-metadata': true,
              'needed-when-embedded': true,
              fieldType: '@cardstack/core-types::belongs-to'
            }).withRelated('related-types', [{ type: 'content-types', id: 'cards' }]),
          ]))
    )));

    factory = new Factory();
    cards.push(addContextForCardDefinition(sourceId, 'team-card', factory.getDocumentFor(
      factory.addResource('card-definitions')
        .withRelated('model', factory.addResource('content-types')
          .withAttributes({
            name: 'teams',
            defaultIncludes: ['searchable-members']
          })
          .withRelated('fields', [
            factory.addResource('fields').withAttributes({
              name: 'members',
              'is-metadata': true,
              'needed-when-embedded': true, // TODO if this is not searchable, perhaps we should not be adding it when its embedded?
              fieldType: '@cardstack/core-types::has-many'
            }).withRelated('related-types', [{ type: 'content-types', id: 'cards' }]),
            factory.addResource('fields').withAttributes({
              name: 'searchable-members',
              'is-metadata': true,
              'needed-when-embedded': true,
              fieldType: '@cardstack/core-types::has-many'
            }).withRelated('related-types', [{ type: 'content-types', id: 'cards' }]),
          ]))
    )));

    factory = new Factory();
    factory.addResource(`${sourceId}::article-card::articles`, `${sourceId}::article-card::1`).withAttributes({
      hello: 'magic words',
      favoriteToy: 'Sneaky Snake',
      favoriteColor: 'red',
      'email-address': 'hassan@example.com'
    });

    // TODO we need a way to seed card instances (so that the cards can be manufactured from their primary models)
    factory.addResource(`${sourceId}::article-card::articles`, `${sourceId}::article-card::2`).withAttributes({
      hello: 'this is article two'
    });

    // TODO we need a way to seed card instances (so that the cards can be manufactured from their primary models)
    factory.addResource(`${sourceId}::person-card::people`, `${sourceId}::person-card::1`).withAttributes({
      firstName: 'Quint',
      lastName: 'Faulkner',
      age: 10,
      favoriteShapes: ['pentagon', 'rhombus', 'circle'],
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

    factory.addResource(`${sourceId}::person-card::people`, `${sourceId}::person-card::2`).withAttributes({
      firstName: 'Arthur',
      lastName: 'Faulkner',
      age: 5,
      favoriteShapes: ['square', 'triangle', 'circle'],
      favoriteColor: 'red'
    });

    for (let i = 0; i < 20; i++) {
      let comment = factory.addResource(`${sourceId}::comment-card::comments`, `${sourceId}::comment-card::${String(i)}`);
      comment.withAttributes({
        body: `comment ${comment.id}`,
        score: Math.abs(10 - i)
      });
      if (i < 4) {
        comment
          .withRelated('article', { type: 'cards', id: `${sourceId}::article-card::1` })
          .withRelated('searchable-article', { type: 'cards', id: `${sourceId}::article-card::1` });
      }
      if (i >= 4 && i < 6) {
        comment
          .withRelated('article', { type: 'cards', id: `${sourceId}::article-card::2` })
          .withRelated('searchable-article', { type: 'cards', id: `${sourceId}::article-card::2` });
      }
    }

    factory.addResource(`${sourceId}::team-card::teams`, `${sourceId}::team-card::1`).withRelated('members', [
      { type: 'cards', id: `${sourceId}::person-card::1` },
      { type: 'cards', id: `${sourceId}::person-card::2` },
    ]).withRelated('searchable-members', [
      { type: 'cards', id: `${sourceId}::person-card::1` },
      { type: 'cards', id: `${sourceId}::person-card::2` },
    ]);

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
      factory.addResource('fields', 'favorite-shapes').withAttributes({
        fieldType: '@cardstack/core-types::string-array'
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
      factory.addResource('fields', 'favorite-toy').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
      factory.addResource('fields', 'email-address').withAttributes({
        fieldType: '@cardstack/core-types::case-insensitive'
      }),
      factory.addResource('fields', 'hello').withAttributes({
        fieldType: '@cardstack/core-types::string'
      })
    ]);

    factory.addResource('content-types', 'comments').withRelated('fields', [
      factory.addResource('fields', 'body').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
      factory.addResource('fields', 'score').withAttributes({
        fieldType: '@cardstack/core-types::integer'
      }),
      factory.addResource('fields', 'article').withAttributes({
        fieldType: '@cardstack/core-types::belongs-to'
      }).withRelated('related-types', [factory.getResource('content-types', 'articles')]),
      factory.addResource('fields', 'searchable-article').withAttributes({
        fieldType: '@cardstack/core-types::belongs-to'
      }).withRelated('related-types', [factory.getResource('content-types', 'articles')])
    ]).withAttributes({
      defaultIncludes: ['searchable-article']
    });

    factory.addResource('articles', '1').withAttributes({
      hello: 'magic words',
      favoriteToy: 'Sneaky Snake',
      favoriteColor: 'red',
      'email-address': 'hassan@example.com'
    });

    factory.addResource('articles', '2').withAttributes({
      hello: 'this is article two'
    });


    factory.addResource('people', '1').withAttributes({
      firstName: 'Quint',
      lastName: 'Faulkner',
      age: 10,
      favoriteShapes: ['pentagon', 'rhombus', 'circle'],
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
      age: 5,
      favoriteShapes: ['square', 'triangle', 'circle'],
      favoriteColor: 'red'
    });

    for (let i = 0; i < 20; i++) {
      let comment = factory.addResource('comments', String(i));
      comment.withAttributes({
        body: `comment ${comment.id}`,
        score: Math.abs(10 - i)
      });
      if (i < 4) {
        comment
          .withRelated('article', factory.getResource('articles', '1'))
          .withRelated('searchable-article', factory.getResource('articles', '1'));
      }
      if (i >= 4 && i < 6) {
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

    let cardModels = [];
    cards.forEach(card => cardModels = cardModels.concat(modelsOf(card)));

    env = await createDefaultEnvironment(`${__dirname}/../../../tests/pgsearch-test-app`, cardModels.concat(factory.getModels()));
    searcher = env.lookup('hub:searchers');
  });

  after(async function () {
    await destroyDefaultEnvironment(env);
  });

  describe('card tests', function () {
    // TODO
  });

  describe('legacy model tests', function () {
    it('can be searched for all content', async function () {
      let { data: models } = await searcher.search(env.session, {
        page: { size: 1000 }
      });
      expect(models.filter(m => m.type === 'comments')).to.have.length(20);
      expect(models.filter(m => m.type === 'people')).to.have.length(2);
      expect(models.filter(m => m.type === 'articles')).to.have.length(2);
    });

    it('returns properly formatted records', async function () {
      let model = (await searcher.get(env.session, 'local-hub', 'people', '1')).data;
      let meta = model.meta;
      expect(Object.keys(meta).sort()).deep.equals(['source', 'version']);
      delete model.meta;
      expect(model).deep.equals({
        type: 'people',
        id: '1',
        attributes: {
          'first-name': 'Quint',
          'last-name': 'Faulkner',
          age: 10,
          'favorite-shapes': ['pentagon', 'rhombus', 'circle'],
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

    it('can be searched via queryString', async function () {
      let { data: models } = await searcher.search(env.session, {
        queryString: 'magic'
      });
      expect(models.filter(m => m.type === 'articles')).to.have.length(1);
      expect(models).includes.something.with.deep.property('attributes.hello', 'magic words');
      expect(models.filter(m => m.type === 'comments')).to.have.length(4);
    });

    it('can be searched via queryString, negative result', async function () {
      let { data: models } = await searcher.search(env.session, {
        queryString: 'thisisanunusedterm'
      });
      expect(models).to.have.length(0);
    });

    it('can filter by type', async function () {
      let { data: models } = await searcher.search(env.session, {
        filter: {
          type: 'articles'
        }
      });
      expect(models).to.have.length(2);
      expect(models).includes.something.with.deep.property('attributes.hello', 'magic words');
    });

    it('can sort by type', async function () {
      let { data: models } = await searcher.search(env.session, {
        filter: {
          type: ['articles', 'people']
        },
        sort: 'type'
      });
      expect(models).to.have.length(4);
      expect(models.map(m => m.type)).deep.equals(['articles', 'articles', 'people', 'people']);
    });

    it('can sort by type in reverse', async function () {
      let { data: models } = await searcher.search(env.session, {
        filter: {
          type: ['articles', 'people']
        },
        sort: '-type'
      });
      expect(models).to.have.length(4);
      expect(models.map(m => m.type)).deep.equals(['people', 'people', 'articles', 'articles']);
    });


    it('can filter by id', async function () {
      let { data: models } = await searcher.search(env.session, {
        filter: {
          id: '1',
          type: ['articles', 'people']
        }
      });
      expect(models).to.have.length(2);
      expect(models).includes.something.with.property('type', 'articles');
      expect(models).includes.something.with.property('type', 'people');
    });

    it('can filter a string-array field by terms', async function () {
      let { data: models } = await searcher.search(env.session, {
        filter: {
          'favorite-shapes': ['hexagon', 'square']
        }
      });
      expect(models).to.have.length(1);
    });

    it('can filter a string-array field one term', async function () {
      let { data: models } = await searcher.search(env.session, {
        filter: {
          'favorite-shapes': 'pentagon'
        }
      });
      expect(models).to.have.length(1);
    });

    it('can sort by id', async function () {
      let { data: models } = await searcher.search(env.session, {
        filter: {
          type: ['articles', 'people']
        },
        sort: 'id'
      });
      expect(models.map(m => m.id)).deep.equals(['1', '1', '2', '2']);
    });

    it('can sort by id in reverse', async function () {
      let { data: models } = await searcher.search(env.session, {
        filter: {
          type: ['articles', 'people']
        },
        sort: '-id'
      });
      expect(models.map(m => m.id)).deep.equals(['2', '2', '1', '1']);
    });


    it('can filter a field by one term', async function () {
      let { data: models } = await searcher.search(env.session, {
        filter: {
          'first-name': 'Quint'
        }
      });
      expect(models).to.have.length(1);
      expect(models).includes.something.with.deep.property('attributes.first-name', 'Quint');
    });

    it('can filter a field by multiple terms', async function () {
      let { data: models } = await searcher.search(env.session, {
        filter: {
          'first-name': ['Quint', 'Arthur']
        }
      });
      expect(models).to.have.length(2);
    });

    it('can use OR expressions in filters', async function () {
      let { data: models } = await searcher.search(env.session, {
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

    it('can use AND expressions in filters', async function () {
      let { data: models } = await searcher.search(env.session, {
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

    it('can use NOT expressions in filters', async function () {
      let { data: models } = await searcher.search(env.session, {
        filter: {
          type: 'people',
          not: { 'first-name': 'Quint' }
        }
      });
      expect(models).to.have.length(1);
      expect(models).includes.something.with.deep.property('attributes.first-name', 'Arthur');
    });


    it('can filter by range', async function () {
      let { data: models } = await searcher.search(env.session, {
        filter: {
          age: {
            range: {
              lt: '7'
            }
          }
        }
      });
      expect(models).to.have.length(1);
      expect(models).includes.something.with.deep.property('attributes.first-name', 'Arthur');
    });

    it('can filter by field existence (string)', async function () {
      let { data: models } = await searcher.search(env.session, {
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

    it('can filter by field nonexistence (string)', async function () {
      let { data: models } = await searcher.search(env.session, {
        filter: {
          'favorite-color': {
            exists: 'false'
          },
          type: 'people'
        }
      });
      expect(models).to.have.length(1);
      expect(models).includes.something.with.deep.property('attributes.first-name', 'Quint');
    });

    it('can filter by field existence (bool)', async function () {
      let { data: models } = await searcher.search(env.session, {
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

    it('can filter by field nonexistence (bool)', async function () {
      let { data: models } = await searcher.search(env.session, {
        filter: {
          'favorite-color': {
            exists: false
          },
          type: 'people'
        }
      });
      expect(models).to.have.length(1);
      expect(models).includes.something.with.deep.property('attributes.first-name', 'Quint');
    });

    it('can search within a field with custom indexing behavior', async function () {
      let { data: models } = await searcher.search(env.session, {
        filter: {
          description: 'atoms'
        }
      });
      expect(models).to.have.length(0);
    });

    it('gives helpful error when filtering unknown field', async function () {
      try {
        await searcher.search(env.session, {
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

    it('can sort', async function () {
      let { data: models } = await searcher.search(env.session, {
        filter: {
          type: 'people'
        },
        sort: 'age'
      });
      expect(models.map(r => r.attributes['first-name'])).to.deep.equal(['Arthur', 'Quint']);
    });


    it('can sort reverse', async function () {
      let { data: models } = await searcher.search(env.session, {
        filter: {
          type: 'people'
        },
        sort: '-age'
      });
      expect(models.map(r => r.attributes['first-name'])).to.deep.equal(['Quint', 'Arthur']);
    });

    it('can sort via field-specific mappings', async function () {
      // string fields are only sortable because of the sortFieldName
      // in @cardstack/core-field-types/string. So this is a test that
      // we're using that capability.
      let { data: models } = await searcher.search(env.session, {
        filter: {
          type: 'people'
        },
        sort: 'first-name'
      });
      expect(models.map(r => r.attributes['first-name'])).to.deep.equal(['Arthur', 'Quint']);
    });


    it('can sort reverse via field-specific mappings', async function () {
      // string fields are only sortable because of the sortFieldName
      // in @cardstack/core-field-types/string. So this is a test that
      // we're using that capability.
      let { data: models } = await searcher.search(env.session, {
        filter: {
          type: 'people'
        },
        sort: '-first-name'
      });
      expect(models.map(r => r.attributes['first-name'])).to.deep.equal(['Quint', 'Arthur']);
    });

    it('has helpful error when sorting by nonexistent field', async function () {
      try {
        await searcher.search(env.session, {
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

    it('can paginate', async function () {
      let response = await searcher.search(env.session, {
        filter: { type: 'comments' },
        page: {
          size: 7
        }
      });
      expect(response.data).length(7);
      expect(response.meta.page).has.property('total', 20);
      expect(response.meta.page).has.property('cursor');

      let allModels = response.data;

      response = await searcher.search(env.session, {
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

      response = await searcher.search(env.session, {
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

    it('can paginate when results exactly fill final page', async function () {
      let response = await searcher.search(env.session, {
        filter: { type: 'comments' },
        page: {
          size: 10
        }
      });
      expect(response.data).length(10);
      expect(response.meta.page).has.property('total', 20);
      expect(response.meta.page).has.property('cursor');

      let allModels = response.data;

      response = await searcher.search(env.session, {
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

    it('can paginate when sorting by custom field', async function () {
      let response = await searcher.search(env.session, {
        filter: { type: 'comments' },
        sort: 'score',
        page: {
          size: 10
        }
      });
      expect(response.data).length(10);
      expect(response.meta.page).has.property('cursor');
      expect(response.data[0].id).to.equal('10');
      expect(response.data[1].id).to.equal('11'); // this relies on knowing that the fallback sort order is type/id
      expect(response.data[2].id).to.equal('9');

      response = await searcher.search(env.session, {
        filter: { type: 'comments' },
        sort: 'score',
        page: {
          size: 10,
          cursor: response.meta.page.cursor
        }
      });
      expect(response.data).length(10);
      expect(response.meta.page).not.has.property('cursor');
      expect(response.data[0].id).to.equal('5');
    });

    it('can get an individual record', async function () {
      let model = await searcher.get(env.session, 'local-hub', 'articles', '1');
      expect(model).has.deep.property('data.attributes.hello', 'magic words');
    });

    it('can do analyzed term matching', async function () {
      let response = await searcher.search(env.session, {
        filter: {
          hello: 'magic'
        }
      });
      expect(response.data).length(1);
      expect(response.data[0]).has.deep.property('attributes.hello', 'magic words');
    });

    it('matches reordered phrase when using analyzed field', async function () {
      let response = await searcher.search(env.session, {
        filter: {
          hello: 'words magic'
        }
      });
      expect(response.data).length(1);
    });

    it('does not match reordered phrase when using exact field', async function () {
      let response = await searcher.search(env.session, {
        filter: {
          hello: { exact: 'words magic' }
        }
      });
      expect(response.data).length(0);
    });


    it('can do exact term matching with a phrase', async function () {
      let response = await searcher.search(env.session, {
        filter: {
          hello: { exact: 'magic words' }
        }
      });
      expect(response.data).length(1);
      expect(response.data[0]).has.deep.property('attributes.hello', 'magic words');
    });

    it('can do exact term matching with a field that contains a capital letter', async function () {
      let response = await searcher.search(env.session, {
        filter: {
          'favorite-toy': { exact: 'Sneaky Snake' }
        }
      });
      expect(response.data).length(1);
      expect(response.data[0]).has.deep.property('attributes.favorite-toy', 'Sneaky Snake');

      response = await searcher.search(env.session, {
        filter: {
          'favorite-toy': { exact: ['Sneaky Snake', 'boisterous baboon'] }
        }
      });

      expect(response.data).length(1);
      expect(response.data[0]).has.deep.property('attributes.favorite-toy', 'Sneaky Snake');
    });

    it('can ignore case when doing exact term matching for a case insensitive field', async function () {
      let response = await searcher.search(env.session, {
        filter: {
          'email-address': { exact: 'HASSAN@EXAMPLE.COM' }
        }
      });
      expect(response.data).length(1);
      expect(response.data[0]).has.deep.property('attributes.email-address', 'hassan@example.com');
    });

    it('incomplete phrase does not match', async function () {
      let response = await searcher.search(env.session, {
        filter: {
          hello: { exact: 'magic words extra' }
        }
      });
      expect(response.data).length(0);
    });

    it('can do exact term matching with multiple phrases', async function () {
      let response = await searcher.search(env.session, {
        filter: {
          hello: { exact: ['something else', 'magic words'] }
        }
      });
      expect(response.data).length(1);
      expect(response.data[0]).has.deep.property('attributes.hello', 'magic words');
    });

    it('can filter non-searchable belongsTo by id', async function () {
      let response = await searcher.search(env.session, {
        filter: {
          'article.id': { exact: '1' }
        }
      });
      expect(response.data).length(4);
    });

    it('can filter searchable belongsTo by id', async function () {
      let response = await searcher.search(env.session, {
        filter: {
          'searchable-article.id': { exact: '1' }
        }
      });
      expect(response.data).length(4);
    });

    it('can filter non-searchable belongsTo by multiple ids', async function () {
      let response = await searcher.search(env.session, {
        filter: {
          'article.id': { exact: ['1', '2'] }
        }
      });
      expect(response.data).length(6);
    });

    it('can filter searchable belongsTo by multiple ids', async function () {
      let response = await searcher.search(env.session, {
        filter: {
          'searchable-article.id': { exact: ['1', '2'] }
        }
      });
      expect(response.data).length(6);
    });

    it('can filter non-searchable hasMany by id', async function () {
      // todo: select array(select jsonb_array_elements(search_doc->'members')->>'id') from documents;
      let response = await searcher.search(env.session, {
        filter: {
          'members.id': { exact: '1' }
        }
      });
      expect(response.data).length(1);
    });

    it('can filter searchable hasMany by id', async function () {
      let response = await searcher.search(env.session, {
        filter: {
          'searchable-members.id': { exact: '1' }
        }
      });
      expect(response.data).length(1);
    });

    it('can filter non-searchable hasMany by multiple id', async function () {
      let response = await searcher.search(env.session, {
        filter: {
          'members.id': { exact: ['1', 'bogus'] }
        }
      });
      expect(response.data).length(1);
    });

    it('can filter searchable hasMany by multiple id', async function () {
      let response = await searcher.search(env.session, {
        filter: {
          'searchable-members.id': { exact: ['1', 'bogus'] }
        }
      });
      expect(response.data).length(1);
    });

    it('belongs-to attributes are not indexed by default', async function () {
      let response = await searcher.search(env.session, {
        filter: {
          'article.hello': 'magic'
        }
      });
      expect(response.data).length(0);
    });

    it('can filter searchable belongs-to by an attribute', async function () {
      let response = await searcher.search(env.session, {
        filter: {
          'searchable-article.hello': 'magic'
        }
      });
      expect(response.data).length(4);
    });

    it('hasMany attributes are not indexed by default', async function () {
      let response = await searcher.search(env.session, {
        filter: {
          'members.first-name': 'Quint'
        }
      });
      expect(response.data).length(0);
    });

    it('can filter searchable has-many by an attribute', async function () {
      let response = await searcher.search(env.session, {
        filter: {
          'searchable-members.first-name': 'Quint'
        }
      });
      expect(response.data).length(1);
    });

    it('can do prefix matching', async function () {
      let { data: models } = await searcher.search(env.session, {
        filter: {
          'last-name': {
            prefix: 'Faulk'
          }
        }
      });
      expect(models).length(2);
      expect(models).includes.something.with.deep.property('attributes.first-name', 'Quint');
      expect(models).includes.something.with.deep.property('attributes.first-name', 'Arthur');
    });
  });
});
