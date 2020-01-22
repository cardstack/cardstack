const supertest = require('supertest');
const Koa = require('koa');
const { createDefaultEnvironment, destroyDefaultEnvironment } = require('@cardstack/test-support/env');
const { currentVersion } = require('./support');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
const log = require('@cardstack/logger')('jsonapi-test');
const defaults = require('superagent-defaults');
const qs = require('qs');
const { removeSync } = require('fs-extra');
const { join } = require('path');
const { tmpdir } = require('os');
const { adaptCardToFormat, cardBrowserAssetFields } = require('@cardstack/plugin-utils/card-utils');

const cardsDir = join(tmpdir(), 'card_modules');
let cardFactory = new JSONAPIFactory();
// This is the internal representation of a card. Browser clients do not
// encounter this form of a card. Look at the jsonapi tests and browser
// tests for the structure of a card as it is known externally.
let internalArticleCard = cardFactory.getDocumentFor(
  cardFactory
    .addResource('local-hub::millenial-puppies', 'local-hub::millenial-puppies')
    .withAttributes({
      'local-hub::millenial-puppies::title': 'The Millenial Puppy',
      'local-hub::millenial-puppies::body': `It can be difficult these days to deal with the discerning tastes of the millenial puppy.`,
    })
    .withRelated('fields', [
      cardFactory.addResource('fields', 'local-hub::millenial-puppies::title').withAttributes({
        'is-metadata': true,
        'needed-when-embedded': true,
        'field-type': '@cardstack/core-types::string', //TODO rework for fields-as-cards
      }),
      cardFactory.addResource('fields', 'local-hub::millenial-puppies::body').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
      }),
    ])
);

describe('jsonapi/middleware', function() {
  let request, env, app;

  function cleanup() {
    removeSync(cardsDir);
  }

  async function sharedSetup() {
    let factory = new JSONAPIFactory();

    factory.addResource('content-types', 'articles').withRelated('fields', [
      factory.addResource('fields', 'title').withAttributes({ fieldType: '@cardstack/core-types::string' }),
      factory.addResource('fields', 'body').withAttributes({ fieldType: '@cardstack/core-types::string' }),
      factory
        .addResource('fields', 'author')
        .withAttributes({ fieldType: '@cardstack/core-types::belongs-to' })
        .withRelated('related-types', [{ type: 'content-types', id: 'authors' }]),
      factory
        .addResource('fields', 'editor')
        .withAttributes({ fieldType: '@cardstack/core-types::belongs-to' })
        .withRelated('related-types', [{ type: 'content-types', id: 'authors' }]),
      factory
        .addResource('fields', 'article-links')
        .withAttributes({
          fieldType: '@cardstack/core-types::has-many',
        })
        .withRelated('related-types', [
          factory
            .addResource('content-types', 'article-links')
            .withRelated('fields', [
              factory.addResource('fields', 'url').withAttributes({ fieldType: '@cardstack/core-types::link' }),
            ]),
        ]),
    ]);

    factory
      .addResource('constraints')
      .withAttributes({ constraintType: '@cardstack/core-types::not-null' })
      .withRelated('input-assignments', [
        factory
          .addResource('input-assignments')
          .withAttributes({ inputName: 'target' })
          .withRelated('field', { type: 'fields', id: 'body' }),
      ]);

    factory
      .addResource('content-types', 'catalogs')
      .withAttributes({
        defaultIncludes: ['favorite-articles', 'featured-article'],
      })
      .withRelated('fields', [
        factory.getResource('fields', 'title'),
        factory.addResource('fields', 'favorite-articles').withAttributes({
          fieldType: '@cardstack/core-types::has-many',
        }),
        factory.addResource('fields', 'featured-article').withAttributes({
          fieldType: '@cardstack/core-types::belongs-to',
        }),
      ]);

    factory
      .addResource('content-types', 'events')
      .withAttributes({
        defaultIncludes: ['similar-articles.author', 'previous.previous'],
      })
      .withRelated('fields', [
        factory.getResource('fields', 'title'),
        factory
          .addResource('fields', 'similar-articles')
          .withAttributes({
            fieldType: '@cardstack/core-types::has-many',
          })
          .withRelated('related-types', [{ type: 'content-types', id: 'articles' }]),
        factory.addResource('fields', 'previous').withAttributes({
          fieldType: '@cardstack/core-types::has-many',
        }),
        factory.addResource('fields', 'next').withAttributes({
          fieldType: '@cardstack/core-types::belongs-to',
        }),
      ]);

    factory.addResource('articles', 0).withAttributes({
      title: 'Hello world',
      body: 'This is the first article',
    });

    factory
      .addResource('articles', 1)
      .withAttributes({
        title: 'Second',
        body: 'This is the second article',
      })
      .withRelated(
        'author',
        factory
          .addResource('authors')
          .withAttributes({
            name: 'Arthur',
          })
          .withRelated('addresses', [
            factory.addResource('addresses').withAttributes({
              street: 'Bay State Ave',
            }),
            factory.addResource('addresses').withAttributes({
              street: 'Dexter Drive',
            }),
          ])
      )
      .withRelated(
        'editor',
        factory
          .addResource('authors', 'q')
          .withAttributes({
            name: 'Quint',
          })
          .withRelated('addresses', [
            factory.addResource('addresses').withAttributes({
              street: 'River Road',
            }),
          ])
      )
      .withRelated('article-links', [
        factory.addResource('article-links', 'link-1').withAttributes({
          url: 'http://cardstack.com/cards/articles/1',
        }),
        factory.addResource('article-links', 'link-2').withAttributes({
          url: 'http://cardstack.com/cards/articles/3',
        }),
      ]);

    factory
      .addResource('articles', 3)
      .withAttributes({
        title: 'third',
        body: 'This is the third article',
      })
      .withRelated('author', factory.getResource('authors', 'q'));

    factory.addResource('articles', 4).withAttributes({ title: 'Space is cool', body: 'This is the fourth article' });
    factory
      .addResource('articles', 5)
      .withAttributes({ title: 'Rube Goldberg machines', body: 'This is the fifth article' });
    factory
      .addResource('articles', 6)
      .withAttributes({ title: "Look ma, I'm going to space!", body: 'This is the sixth article' });
    factory
      .addResource('articles', 7)
      .withAttributes({ title: 'Black body radiators', body: 'This is the seventh article' });
    factory
      .addResource('articles', 8)
      .withAttributes({ title: 'How to mend a space suit', body: 'This is the eighth article' });

    factory
      .addResource('catalogs', 1)
      .withAttributes({ title: 'Article Catalog' })
      .withRelatedLink(
        'favorite-articles',
        `/api?${qs.stringify({
          filter: {
            type: { exact: 'articles' },
          },
          sort: 'title',
          page: { size: 3 },
        })}`
      )
      .withRelatedLink(
        'featured-article',
        `/api?${qs.stringify({
          filter: {
            type: { exact: 'articles' },
            title: 'goldberg',
          },
          page: { size: 1 },
        })}`
      );

    factory
      .addResource('authors')
      .withAttributes({
        name: 'Lycia',
      })
      .withRelated('addresses', [
        factory.addResource('addresses').withAttributes({
          street: 'Elsewhere',
        }),
      ]);

    factory
      .addResource('events', '1')
      .withAttributes({ title: 'First Event' })
      .withRelated('similar-articles', [factory.getResource('articles', '0'), factory.getResource('articles', '1')]);

    factory
      .addResource('events', '2')
      .withAttributes({ title: 'Second Event' })
      .withRelated('previous', [factory.getResource('events', '1')]);

    factory
      .addResource('events', '3')
      .withAttributes({ title: 'Third Event' })
      .withRelated('previous', [factory.getResource('events', '2'), factory.getResource('events', '1')]);

    factory.addResource('events', '4').withAttributes({ title: 'Fourth Event' });

    factory
      .addResource('events', '5')
      .withAttributes({ title: 'Fifth Event' })
      .withRelated('next', factory.getResource('events', '4'));

    factory.addResource('content-types', 'authors').withRelated('fields', [
      factory.addResource('fields', 'name').withAttributes({
        'field-type': '@cardstack/core-types::string',
      }),
      factory
        .addResource('fields', 'addresses')
        .withAttributes({
          'field-type': '@cardstack/core-types::has-many',
        })
        .withRelated('related-types', [
          factory.addResource('content-types', 'addresses').withRelated('fields', [
            factory.addResource('fields', 'street').withAttributes({
              'field-type': '@cardstack/core-types::string',
            }),
          ]),
        ]),
    ]);

    app = new Koa();
    env = await createDefaultEnvironment(__dirname + '/../', factory.getModels());
    app.use(async function(ctxt, next) {
      await next();
      log.info('%s %s %s', ctxt.request.method, ctxt.request.originalUrl, ctxt.response.status);
    });
    app.use(env.lookup('hub:middleware-stack').middleware());
    request = defaults(supertest(app.callback()));
    request.set('Accept', 'application/vnd.api+json');
  }

  async function sharedTeardown() {
    cleanup();
    await destroyDefaultEnvironment(env);
  }

  describe('non-mutating tests', function() {
    // this section is for non-mutating tests meaning ones that don't
    // alter the server state. That allows us to run the setup and
    // teardown only once for this whole section, which greatly speeds
    // up testing.
    before(sharedSetup);
    after(sharedTeardown);

    it('can get an individual resource', async function() {
      let response = await request.get('/api/articles/0');
      expect(response).hasStatus(200);
      expect(response.body).deep.property('data.id', '0');
      expect(response.body).deep.property('data.attributes.title', 'Hello world');
      expect(response.body).to.not.have.deep.property('data.relationships');
    });

    it('returns 404 for missing individual resource', async function() {
      let response = await request.get('/api/articles/98766');
      expect(response).hasStatus(404);
      expect(response.body).to.have.deep.property('errors[0].detail', 'No such resource articles/98766');
    });

    it('can get a collection resource', async function() {
      let response = await request.get('/api/articles');
      expect(response).hasStatus(200);
      expect(response.body).to.have.property('data');
      expect(response.body).to.have.deep.property('meta.total', 8);
      expect(response.body.data).length(8);
      expect(response.body.data.map(item => item.type).filter((v, i, a) => a.indexOf(v) === i)).to.eql(['articles']);
      expect(response.body.data.map(item => item.id)).to.eql(['0', '1', '3', '4', '5', '6', '7', '8']);
    });

    it('can sort a collection resource', async function() {
      let response = await request.get('/api/articles?sort=title');
      expect(response).hasStatus(200);
      expect(response.body).to.have.property('data');
      expect(response.body).has.deep.property('data[0].attributes.title', 'Black body radiators');
      expect(response.body).has.deep.property('data[1].attributes.title', 'Hello world');
    });

    it('can reverse sort a collection resource', async function() {
      let response = await request.get('/api/articles?sort=-title&filter[id][]=0&filter[id][]=1');
      expect(response).hasStatus(200);
      expect(response.body).has.property('data');
      expect(response.body).has.deep.property('data[0].attributes.title', 'Second');
      expect(response.body).has.deep.property('data[1].attributes.title', 'Hello world');
    });

    it('can filter a collection resource', async function() {
      let response = await request.get('/api/articles?filter[title]=world');
      expect(response).hasStatus(200);
      expect(response.body).has.property('data');
      expect(response.body.data).length(1);
      expect(response.body).has.deep.property('data[0].attributes.title', 'Hello world');
    });

    it('can use query string', async function() {
      let response = await request.get('/api/articles?q=second');
      expect(response).hasStatus(200);
      expect(response.body).has.property('data');
      expect(response.body.data).length(1);
      expect(response.body).has.deep.property('data[0].attributes.title', 'Second');
    });

    it('can use query string to query all types using bare api endpoint', async function() {
      let response = await request.get('/api?q=second');
      expect(response).hasStatus(200);
      expect(response.body).has.property('data');
      // TODO: this expectation has been figured out experimentally. We should verify
      // that we want each of the returned cards included in the search results
      expect(response.body.data).length(6);
      expect(response.body).has.deep.property('data[0].attributes.title', 'Second');
    });

    it('can paginate a collection resource', async function() {
      let response = await request.get('/api/articles?page[size]=1&sort=title');
      expect(response).hasStatus(200, 'first request');
      expect(response.body.data).length(1);
      expect(response.body).has.deep.property('data[0].attributes.title', 'Black body radiators');
      expect(response.body).has.deep.property('links.next');

      let nextLink = makeRelativeLink(response, response.body.links.next);

      response = await request.get(nextLink);
      expect(response).hasStatus(200, 'second request');
      expect(response.body).has.deep.property('data[0].attributes.title', 'Hello world');
      expect(response.body.data).length(1);
    });

    it('gets 403 when creating unknown resource', async function() {
      let response = await request.post('/api/bogus').send({
        data: {
          type: 'bogus',
          attributes: {
            title: 'I am new',
          },
        },
      });
      expect(response.status).to.equal(403);
      expect(response.body).has.deep.property('errors[0].detail', '"bogus" is not a writable type');
    });

    it('gets 400 when creating a resource with no body', async function() {
      let response = await request.post('/api/articles');
      expect(response.status).to.equal(400);
      expect(response.body).has.deep.property(
        'errors[0].detail',
        'A body with a top-level "data" property is required'
      );
    });

    it('gets 400 when creating a resource with no data property', async function() {
      let response = await request.post('/api/articles').send({ datum: {} });
      expect(response.status).to.equal(400);
      expect(response.body).has.deep.property(
        'errors[0].detail',
        'A body with a top-level "data" property is required'
      );
    });

    it('gets 404 when patching a missing resource', async function() {
      let version = await currentVersion(request, '/api/articles/0');

      let response = await request.patch('/api/articles/100').send({
        data: {
          id: '100',
          type: 'articles',
          attributes: {
            title: 'Updated title',
          },
          meta: { version },
        },
      });
      expect(response.status).to.equal(404);
      expect(response.body).has.deep.property('errors[0].detail', 'articles with id 100 does not exist');
    });

    it('refuses to delete without version', async function() {
      let response = await request.delete('/api/articles/0');
      expect(response).hasStatus(400);
      expect(response.body).has.deep.property('errors[0].detail', 'version is required');
      expect(response.body).has.deep.property('errors[0].source.header', 'If-Match');
    });

    it('refuses to delete with invalid version', async function() {
      let response = await request.delete('/api/articles/0').set('If-Match', 'xxx');
      expect(response).hasStatus(409);
      expect(response.body).has.deep.property('errors[0].source.header', 'If-Match');
    });

    it('validates schema during POST', async function() {
      let response = await request.post('/api/articles').send({
        data: {
          type: 'articles',
          attributes: {
            title: 3,
          },
        },
      });
      expect(response).hasStatus(422);
      expect(response.body.errors).length(2);
      expect(response.body.errors).collectionContains({
        title: 'Validation error',
        detail: '3 is not a valid value for field "title"',
        source: { pointer: '/data/attributes/title' },
      });
      expect(response.body.errors).collectionContains({
        title: 'Validation error',
        detail: 'Body must be present',
        source: { pointer: '/data/attributes/body' },
      });
    });

    it('validates schema during PATCH', async function() {
      let version = await currentVersion(request, '/api/articles/0');
      let response = await request.patch('/api/articles/0').send({
        data: {
          id: '0',
          type: 'articles',
          attributes: {
            title: 3,
          },
          meta: { version },
        },
      });
      expect(response.status).to.equal(422);

      // we should not hit the body not-null constraint here, since
      // we're leaving it unchanged
      expect(response.body.errors).length(1);

      expect(response.body.errors).collectionContains({
        title: 'Validation error',
        detail: '3 is not a valid value for field "title"',
        source: { pointer: '/data/attributes/title' },
      });
    });

    it.skip('rejects unknown includes on individual resource', async function() {
      let response = await request.get('/api/articles/1?include=author.addresses,editor.bogus');
      expect(response.status).to.equal(400);
      expect(response.body.errors).length(1);
      expect(response.body.errors).collectionContains({
        title: 'Bad Request',
        detail: 'The relationship "editor.bogus" is not valid',
        source: { queryParameter: 'include' },
      });
    });

    it.skip('rejects unknown includes on collection resource', async function() {
      let response = await request.get('/api/articles?include=author.addresses,editor.bogus');
      expect(response.status).to.equal(400);
      expect(response.body.errors).length(1);
      expect(response.body.errors).collectionContains({
        title: 'Bad Request',
        detail: 'The relationship "editor.bogus" is not valid',
        source: { queryParameter: 'include' },
      });
    });

    it('can get an individual resource with includes', async function() {
      let response = await request.get('/api/articles/1?include=author.addresses,editor');
      expect(response).hasStatus(200);
      expect(response.body).deep.property('data.id', '1');
      expect(response.body).deep.property('data.relationships.author.data.id');
      expect(response.body).has.property('included');
      let included = response.body.included;
      expect(included).is.a('array');

      let authorNames = included.filter(r => r.type === 'authors').map(r => r.attributes.name);
      expect(authorNames).to.include('Arthur');
      expect(authorNames).to.include('Quint');
      expect(authorNames).not.to.include('Lycia');
      expect(authorNames).length(2);

      let streets = included.filter(r => r.type === 'addresses').map(r => r.attributes.street);
      expect(streets).to.include('Bay State Ave');
      expect(streets).to.include('Dexter Drive');
      expect(streets).not.to.include('Elsewhere');
      expect(streets).length(2);

      expect(included).has.length(4);
    });

    it('can get a collection resource with includes', async function() {
      let response = await request.get('/api/articles?include=editor.addresses&filter[id][]=0&filter[id][]=1');
      expect(response).hasStatus(200);
      expect(response.body.data).has.length(2);
      expect(response.body).has.property('included');
      let included = response.body.included;
      expect(included).is.a('array');

      let authorNames = included.filter(r => r.type === 'authors').map(r => r.attributes.name);
      expect(authorNames).to.deep.equal(['Quint']);

      let streets = included.filter(r => r.type === 'addresses').map(r => r.attributes.street);
      expect(streets).to.deep.equal(['River Road']);
      expect(included).has.length(2);
    });

    it('can get an individual resource with default includes', async function() {
      let response = await request.get('/api/events/1');
      expect(response).hasStatus(200);
      expect(response.body).deep.property('data.id', '1');
      expect(response.body).deep.property('data.relationships.similar-articles.data');
      expect(response.body.data.relationships['similar-articles'].data).length(2);
      expect(response.body).has.property('included');
      let included = response.body.included;
      expect(included).is.a('array');

      let authorNames = included.filter(r => r.type === 'authors').map(r => r.attributes.name);
      expect(authorNames).length(1);
      expect(authorNames).to.include('Arthur');

      let articleIds = included.filter(r => r.type === 'articles').map(r => r.id);
      expect(articleIds).length(2);
      expect(articleIds).to.include('0');
      expect(articleIds).to.include('1');
    });

    it('can get an individual resource with a query relationship', async function() {
      let response = await request.get('/api/catalogs/1');
      expect(response).hasStatus(200);
      expect(response.body).has.deep.property('data.id', '1');
      expect(response.body).has.deep.property('data.attributes.title', 'Article Catalog');
      expect(response.body).has.deep.property(
        'data.relationships.favorite-articles.links.related',
        '/api?filter%5Btype%5D%5Bexact%5D=articles&sort=title&page%5Bsize%5D=3'
      );
      expect(response.body.data.relationships['favorite-articles'].data.map(item => item.id)).to.eql(['7', '0', '8']);
      expect(response.body).has.deep.property(
        'data.relationships.featured-article.links.related',
        '/api?filter%5Btype%5D%5Bexact%5D=articles&filter%5Btitle%5D=goldberg&page%5Bsize%5D=1'
      );
      expect(response.body.data.relationships['featured-article'].data.id).to.equal('5');
      expect(response.body).has.deep.property('data.meta.version');
      expect(response.body).has.property('included');

      let articleTitles = response.body.included.filter(r => r.type === 'articles').map(r => r.attributes.title);
      expect(articleTitles).length(4);
      expect(articleTitles).to.include('Black body radiators');
      expect(articleTitles).to.include('Hello world');
      expect(articleTitles).to.include('How to mend a space suit');
      expect(articleTitles).to.include('Rube Goldberg machines');
    });

    it('can override default includes with no includes', async function() {
      let response = await request.get('/api/events/1?include=');
      expect(response).hasStatus(200);
      expect(response.body).deep.property('data.id', '1');
      expect(response.body).deep.property('data.relationships.similar-articles.data');
      expect(response.body.data.relationships['similar-articles'].data).length(2);
      expect(response.body).not.has.property('included');
    });

    it('can override default includes with less includes', async function() {
      let response = await request.get('/api/events/1?include=similar-articles');
      expect(response).hasStatus(200);
      expect(response.body).deep.property('data.id', '1');
      expect(response.body).deep.property('data.relationships.similar-articles.data');
      expect(response.body.data.relationships['similar-articles'].data).length(2);
      expect(response.body).has.property('included');

      let included = response.body.included;
      expect(included).is.a('array');
      expect(included).length(2);
      expect(included.filter(r => r.type === 'articles')).length(2);
    });

    it('can override default includes with more includes', async function() {
      let response = await request.get('/api/events/1?include=similar-articles.author.addresses');
      expect(response).hasStatus(200);
      expect(response.body).deep.property('data.id', '1');
      expect(response.body).deep.property('data.relationships.similar-articles.data');
      expect(response.body.data.relationships['similar-articles'].data).length(2);
      expect(response.body).has.property('included');
      let included = response.body.included;
      expect(included).is.a('array');

      let authorNames = included.filter(r => r.type === 'authors').map(r => r.attributes.name);
      expect(authorNames).length(1);
      expect(authorNames).to.include('Arthur');

      let articleIds = included.filter(r => r.type === 'articles').map(r => r.id);
      expect(articleIds).length(2);
      expect(articleIds).to.include('0');
      expect(articleIds).to.include('1');

      let streets = included.filter(r => r.type === 'addresses').map(r => r.attributes.street);
      expect(streets).to.include('Bay State Ave');
      expect(streets).to.include('Dexter Drive');
      expect(streets).length(2);
    });

    it('can get a collection resource with default includes', async function() {
      let response = await request.get('/api/events?filter[id]=1');
      expect(response).hasStatus(200);
      expect(response.body).has.property('included');
      let included = response.body.included;
      expect(included).is.a('array');

      let authorNames = included.filter(r => r.type === 'authors').map(r => r.attributes.name);
      expect(authorNames).length(1);
      expect(authorNames).to.include('Arthur');

      let articleIds = included.filter(r => r.type === 'articles').map(r => r.id);
      expect(articleIds).length(2);
      expect(articleIds).to.include('0');
      expect(articleIds).to.include('1');
    });

    it('can override default includes of a collection resource with no includes', async function() {
      let response = await request.get('/api/events?filter[id]=1&include=');
      expect(response).hasStatus(200);
      expect(response.body).not.has.property('included');
    });

    it('de-duplicates when there are multiple paths to an included resource (with default includes, single endpoint)', async function() {
      let response = await request.get('/api/events/3');
      expect(response).hasStatus(200);
      expect(response.body).has.property('included');
      let included = response.body.included;
      expect(included).is.a('array');
      expect(included).length(2);
    });

    it('de-duplicates when there are multiple paths to an included resource (with default includes, collection endpoint)', async function() {
      let response = await request.get('/api/events?filter[id]=3');
      expect(response).hasStatus(200);
      expect(response.body).has.property('included');
      let included = response.body.included;
      expect(included).is.a('array');
      expect(included).length(2);
    });

    it('de-duplicates when there are multiple paths to an included resource (without default includes)', async function() {
      let response = await request.get('/api/articles?include=author.addresses,editor.addresses');
      expect(response).hasStatus(200);
      expect(response.body).has.property('included');
      let included = response.body.included;
      expect(included).is.a('array');

      let authorNames = included.filter(r => r.type === 'authors').map(r => r.attributes.name);
      expect(authorNames).to.include('Arthur');
      expect(authorNames).to.include('Quint');
      expect(authorNames).length(2);

      let streets = included.filter(r => r.type === 'addresses').map(r => r.attributes.street);
      expect(streets).to.include('Bay State Ave');
      expect(streets).to.include('Dexter Drive');
      expect(streets).to.include('River Road');
      expect(streets).length(3);
    });

    it('de-duplicates when a root resource is also an included resource (with default includes)', async function() {
      let response = await request.get('/api/events');
      expect(response).hasStatus(200);
      expect(response.body).has.property('included');
      let included = response.body.included;
      expect(included).is.a('array');
      let otherEvents = included.filter(e => e.type === 'events');
      expect(otherEvents).length(0);
      expect(response.body.data).length(5);
    });

    it('de-duplicates when a root resource is also an included resource (without default includes)', async function() {
      let response = await request.get('/api/events?include=next&filter[id][]=4&filter[id][]=5');
      expect(response).hasStatus(200);
      expect(response.body).not.has.property('included');
    });
  });

  describe('mutating tests', function() {
    // this section is for mutating tests, meaning ones that alter the
    // server state. For these we setup a fresh environment per test,
    // which is slow than the non-mutating tests.
    beforeEach(sharedSetup);
    afterEach(sharedTeardown);

    it('can create a new resource', async function() {
      let response = await request.post('/api/articles').send({
        data: {
          type: 'articles',
          attributes: {
            title: 'I am new',
            body: 'xxx',
          },
        },
      });

      expect(response).hasStatus(201);
      expect(response.headers).has.property('location');
      expect(response.body).has.deep.property('data.id');
      expect(response.body).has.deep.property('data.attributes.title', 'I am new');
      expect(response.body).has.deep.property('data.meta.version');

      response = await request.get(makeRelativeLink(response, response.headers.location));
      expect(response).hasStatus(200);
      expect(response.body).has.deep.property('data.attributes.title', 'I am new', 'second time');
    });

    it('can create a new resource with a has-many query relationships', async function() {
      let query = {
        filter: {
          type: { exact: 'articles' },
          title: 'space',
        },
      };

      let response = await request.post('/api/catalogs').send({
        data: {
          type: 'catalogs',
          attributes: {
            title: 'Articles about Space',
          },
          relationships: {
            'favorite-articles': {
              data: [
                {
                  type: 'cardstack-queries',
                  id: `/api?${qs.stringify(query)}`,
                },
              ],
            },
          },
        },
      });

      expect(response).hasStatus(201);
      expect(response.headers).has.property('location');
      expect(response.body).has.deep.property('data.id');
      expect(response.body).has.deep.property('data.attributes.title', 'Articles about Space');
      expect(response.body).has.deep.property(
        'data.relationships.favorite-articles.links.related',
        '/api?filter%5Btype%5D%5Bexact%5D=articles&filter%5Btitle%5D=space'
      );
      expect(response.body).has.deep.property('data.meta.version');

      response = await request.get(makeRelativeLink(response, response.headers.location));
      expect(response).hasStatus(200);
      expect(response.body.data.relationships['favorite-articles'].data).length(3);
      expect(response.body.data.relationships['favorite-articles'].data.map(item => item.id)).to.eql(['4', '6', '8']);
    });

    it('can create a new resource with a belongs-to query relationships', async function() {
      let query = {
        filter: {
          type: { exact: 'articles' },
          title: 'goldberg',
        },
        page: { size: 1 },
      };

      let response = await request.post('/api/catalogs').send({
        data: {
          type: 'catalogs',
          attributes: {
            title: 'Curious Machines',
          },
          relationships: {
            'featured-article': {
              data: {
                type: 'cardstack-queries',
                id: `/api?${qs.stringify(query)}`,
              },
            },
          },
        },
      });

      expect(response).hasStatus(201);
      expect(response.headers).has.property('location');
      expect(response.body).has.deep.property('data.id');
      expect(response.body).has.deep.property('data.attributes.title', 'Curious Machines');
      expect(response.body).has.deep.property(
        'data.relationships.featured-article.links.related',
        '/api?filter%5Btype%5D%5Bexact%5D=articles&filter%5Btitle%5D=goldberg&page%5Bsize%5D=1'
      );
      expect(response.body).has.deep.property('data.meta.version');

      response = await request.get(makeRelativeLink(response, response.headers.location));
      expect(response).hasStatus(200);
      expect(response.body.data.relationships['featured-article'].data.id).to.equal('5');
      expect(response.body.data.relationships['featured-article'].data.type).to.equal('articles');
    });

    it('can update an existing resource', async function() {
      let version = await currentVersion(request, '/api/articles/0');

      let response = await request.patch('/api/articles/0').send({
        data: {
          id: '0',
          type: 'articles',
          attributes: {
            title: 'Updated title',
          },
          meta: { version },
        },
      });

      expect(response).hasStatus(200);
      expect(response).has.deep.property('body.data.attributes.title', 'Updated title');
      expect(response).has.deep.property('body.data.attributes.body', 'This is the first article');

      response = await request.get('/api/articles/0');
      expect(response).hasStatus(200);
      expect(response).has.deep.property('body.data.attributes.title', 'Updated title', 'second time');
      expect(response).has.deep.property('body.data.attributes.body', 'This is the first article', 'second time');
    });

    it('can update an existing resource with a has-many query relationships', async function() {
      let version = await currentVersion(request, '/api/catalogs/1');
      let query = {
        filter: {
          type: { exact: 'articles' },
          title: 'space',
        },
      };

      let response = await request.patch('/api/catalogs/1').send({
        data: {
          type: 'catalogs',
          id: '1',
          attributes: {
            title: 'Articles about Space',
          },
          relationships: {
            'favorite-articles': {
              data: [
                {
                  type: 'cardstack-queries',
                  id: `/api?${qs.stringify(query)}`,
                },
              ],
            },
          },
          meta: { version },
        },
      });

      expect(response).hasStatus(200);
      expect(response.body).has.deep.property('data.id');
      expect(response.body).has.deep.property('data.attributes.title', 'Articles about Space');
      expect(response.body).has.deep.property(
        'data.relationships.favorite-articles.links.related',
        '/api?filter%5Btype%5D%5Bexact%5D=articles&filter%5Btitle%5D=space'
      );
      expect(response.body).has.deep.property('data.meta.version');
      expect(response.body.data.relationships['favorite-articles'].data).length(3);
      expect(response.body.data.relationships['favorite-articles'].data.map(item => item.id)).to.eql(['4', '6', '8']);
    });

    it('can delete a resource', async function() {
      let version = await currentVersion(request, '/api/articles/0');

      let response = await request.delete('/api/articles/0').set('If-Match', version);
      expect(response).hasStatus(204);

      response = await request.get('/api/articles/0');
      expect(response).hasStatus(404);
    });
  });

  describe('auth tests', function() {
    before(sharedSetup);
    after(sharedTeardown);
    beforeEach(function() {
      env.setUserId('the-default-test-user');
    });

    it('applies authorization during create', async function() {
      await env.setUserId(null);
      let response = await request.post('/api/articles').send({
        data: {
          type: 'articles',
          attributes: {
            title: 'I am new',
            body: 'xxx',
          },
        },
      });
      expect(response.status).to.equal(404);
    });

    it('applies authorization during update', async function() {
      let version = await currentVersion(request, '/api/articles/0');
      await env.setUserId(null);
      let response = await request.patch('/api/articles/0').send({
        data: {
          id: '0',
          type: 'articles',
          attributes: {
            title: 'Updated title',
          },
          meta: { version },
        },
      });
      expect(response).hasStatus(404);
    });

    it('applies authorization during delete', async function() {
      let version = await currentVersion(request, '/api/articles/0');
      await env.setUserId(null);
      let response = await request.delete('/api/articles/0').set('If-Match', version);
      expect(response).hasStatus(401);
    });

    it('applies authorization during individual get', async function() {
      await env.setUserId(null);
      let response = await request.get('/api/articles/0');
      expect(response).hasStatus(404);
      expect(response.body).to.have.deep.property('errors[0].detail', 'No such resource articles/0');
    });

    it('applies authorization during collection get', async function() {
      await env.setUserId(null);
      let response = await request.get('/api/articles');
      expect(response).hasStatus(200);
      expect(response.body).to.have.property('data');
      expect(response.body).to.have.deep.property('meta.total', 0);
      expect(response.body.data).length(0);
    });
  });

  describe('card tests', function() {
    describe('non-mutating card tests', function() {
      beforeEach(async function() {
        cleanup();
        let factory = new JSONAPIFactory();
        factory.addResource('data-sources', 'stub-card-project').withAttributes({
          sourceType: 'stub-card-project',
          params: {
            cardSearchResults: [internalArticleCard],
          },
        });

        app = new Koa();
        env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-card-project`, factory.getModels());
        let cardServices = env.lookup('hub:card-services');
        await cardServices._setupPromise;
        app.use(async function(ctxt, next) {
          await next();
          log.info('%s %s %s', ctxt.request.method, ctxt.request.originalUrl, ctxt.response.status);
        });
        app.use(env.lookup('hub:middleware-stack').middleware());
        request = defaults(supertest(app.callback()));
        request.set('Accept', 'application/vnd.api+json');
      });

      afterEach(sharedTeardown);

      it('has card metadata for isolated format', async function() {
        let response = await request.get('/api/cards/local-hub::millenial-puppies?format=isolated');
        expect(response).hasStatus(200);
        assertIsolatedCardMetadata(response.body);
      });

      it('has card metadata for embedded format', async function() {
        let response = await request.get('/api/cards/local-hub::millenial-puppies?format=embedded');
        expect(response).hasStatus(200);
        assertEmbeddedCardMetadata(response.body);
        expect(response.body.included.length).to.equal(0);
      });

      it("when no format is specifed, the default format is 'embedded'", async function() {
        let response = await request.get('/api/cards/local-hub::millenial-puppies');
        expect(response).hasStatus(200);
        assertEmbeddedCardMetadata(response.body);
      });
    });

    describe('mutating card tests', async function() {
      beforeEach(async function() {
        app = new Koa();
        env = await createDefaultEnvironment(__dirname + '/../');
        app.use(async function(ctxt, next) {
          await next();
          log.info('%s %s %s', ctxt.request.method, ctxt.request.originalUrl, ctxt.response.status);
        });
        app.use(env.lookup('hub:middleware-stack').middleware());
        request = defaults(supertest(app.callback()));
        request.set('Accept', 'application/vnd.api+json');
      });

      afterEach(sharedTeardown);

      it('can create a new card', async function() {
        let card = await convertToExternalFormat(env, internalArticleCard);
        let response = await request.post('/api/cards').send(card);
        expect(response).hasStatus(201);
        assertIsolatedCardMetadata(response.body);

        response = await request.get('/api/cards/local-hub::millenial-puppies?format=isolated');
        expect(response).hasStatus(200);
        assertIsolatedCardMetadata(response.body);
      });

      it('can update a card', async function() {
        let externalArticleCard = await convertToExternalFormat(env, internalArticleCard);
        let { body: card } = await request.post('/api/cards').send(externalArticleCard);
        let internalModel = card.included.find(i => (i.type = 'local-hub::millenial-puppies'));
        internalModel.attributes.author = 'Van Gogh';
        card.data.relationships.fields.data.push({ type: 'fields', id: 'author' });
        card.included.push({
          type: 'fields',
          id: 'author',
          attributes: {
            'is-metadata': true,
            'needed-when-embedded': true,
            'field-type': '@cardstack/core-types::string',
          },
        });

        let response = await request.patch('/api/cards/local-hub::millenial-puppies').send(card);
        expect(response).hasStatus(200);
        expect(response).has.deep.property('body.data.attributes.author', 'Van Gogh');

        response = await request.get('/api/cards/local-hub::millenial-puppies');
        expect(response).hasStatus(200);
        expect(response).has.deep.property('body.data.attributes.author', 'Van Gogh');
      });

      it('can delete a card', async function() {
        let externalArticleCard = await convertToExternalFormat(env, internalArticleCard);
        let { body: card } = await request.post('/api/cards').send(externalArticleCard);
        let {
          data: {
            meta: { version },
          },
        } = card;

        let response = await request.delete('/api/cards/local-hub::millenial-puppies').set('If-Match', version);
        expect(response).hasStatus(204);

        response = await request.get('/api/cards/local-hub::millenial-puppies');
        expect(response).hasStatus(404);
      });
    });
  });
});

function makeRelativeLink(response, url) {
  let host = response.req.getHeader('host');
  let origin = `http://${host}`;
  if (url.indexOf(origin) !== 0) {
    throw new Error(`expected ${url} to have origin ${origin}`);
  }
  return url.replace(origin, '');
}

function assertIsolatedCardMetadata(card) {
  let { data } = card;
  expect(data.attributes.title).to.equal('The Millenial Puppy');
  expect(data.attributes.body).to.match(/discerning tastes of the millenial puppy/);
}

function assertEmbeddedCardMetadata(card) {
  let { data } = card;

  expect(data.attributes.title).to.equal('The Millenial Puppy');
  expect(data.attributes.body).to.be.undefined;
}

async function convertToExternalFormat(env, internalCard) {
  let searchers = env.lookup('hub:searchers');
  let externalCard = await adaptCardToFormat(
    await env.lookup('hub:current-schema').getSchema(),
    env.session,
    internalCard,
    'isolated',
    searchers
  );

  // remove the card metadata to make this as real as possible...
  for (let field of Object.keys(externalCard.data.attributes)) {
    if (cardBrowserAssetFields.includes(field)) {
      continue;
    }
    delete externalCard.data.attributes[field];
  }

  return externalCard;
}
