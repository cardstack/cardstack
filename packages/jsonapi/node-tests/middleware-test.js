const supertest = require('supertest');
const Koa = require('koa');
const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('@cardstack/test-support/env');
const { currentVersion } = require('./support');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
const log = require('@cardstack/plugin-utils/logger')('jsonapi-test');

describe('jsonapi/middleware', function() {

  let request, env;

  async function sharedSetup() {
    let factory = new JSONAPIFactory();
    let articleType = factory.addResource('content-types', 'articles');

    articleType.withRelated('fields', [
      factory.addResource('fields', 'title')
        .withAttributes({ fieldType: '@cardstack/core-types::string' }),
      factory.addResource('fields', 'body')
        .withAttributes({ fieldType: '@cardstack/core-types::string' })
    ]);

    factory.addResource('constraints')
      .withAttributes({ constraintType: '@cardstack/core-types::not-null' })
      .withRelated('input-assignments', [
        factory.addResource('input-assignments')
          .withAttributes({ inputName: 'target'})
          .withRelated('field', { type: 'fields', id: 'body' })
      ]);

    factory.addResource('content-types', 'events')
      .withRelated('fields', [
        factory.getResource('fields', 'title')
      ]);

    factory.addResource('articles', 0)
      .withAttributes({
        title: "Hello world",
        body: "This is the first article"
      });

    factory.addResource('articles', 1)
      .withAttributes({
        title: "Second",
        body: "This is the second article"
      });


    factory.addResource('plugin-configs')
      .withAttributes({
        module: "@cardstack/jsonapi"
      });

    factory.addResource('plugin-configs')
      .withAttributes({
        module: "@cardstack/test-support/authenticator"
      });

    let app = new Koa();
    env = await createDefaultEnvironment(__dirname + '/../', factory.getModels());
    app.use(async function(ctxt, next) {
      await next();
      log.info('%s %s %s', ctxt.request.method, ctxt.request.originalUrl, ctxt.response.status);
    });
    app.use(env.lookup('hub:middleware-stack').middleware());
    request = supertest(app.callback());
  }

  async function sharedTeardown() {
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
      expect(response.body).not.deep.property('data.relationships');
    });

    it('returns 404 for missing individual resource', async function() {
      let response = await request.get('/api/articles/98766');
      expect(response).hasStatus(404);
      expect(response.body).to.have.deep.property('errors[0].detail', 'No such resource master/articles/98766');
    });

    it('can get a collection resource', async function() {
      let response = await request.get('/api/articles');
      expect(response).hasStatus(200);
      expect(response.body).to.have.property('data');
      expect(response.body).to.have.deep.property('meta.total', 2);
      expect(response.body.data).length(2);
      expect(response.body.data).collectionContains({ type: 'articles', id: '0' });
      expect(response.body.data).collectionContains({ type: 'articles', id: '1' });
    });

    it('can sort a collection resource', async function() {
      let response = await request.get('/api/articles?sort=title');
      expect(response).hasStatus(200);
      expect(response.body).to.have.property('data');
      expect(response.body).has.deep.property('data[0].attributes.title', 'Hello world');
      expect(response.body).has.deep.property('data[1].attributes.title', 'Second');
    });

    it('can reverse sort a collection resource', async function() {
      let response = await request.get('/api/articles?sort=-title');
      expect(response).hasStatus(200);
      expect(response.body).has.property('data');
      expect(response.body).has.deep.property('data[1].attributes.title', 'Hello world');
      expect(response.body).has.deep.property('data[0].attributes.title', 'Second');
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

    it('can paginate a collection resource', async function() {
      let response = await request.get('/api/articles?page[size]=1&sort=title');
      expect(response).hasStatus(200, 'first request');
      expect(response.body.data).length(1);
      expect(response.body).has.deep.property('data[0].attributes.title', 'Hello world');
      expect(response.body).has.deep.property('links.next');

      let nextLink = makeRelativeLink(response, response.body.links.next);

      response = await request.get(nextLink);
      expect(response).hasStatus(200, 'second request');
      expect(response.body).has.deep.property('data[0].attributes.title', 'Second');
      expect(response.body.data).length(1);
    });

    it('gets 403 when creating unknown resource', async function() {
      let response = await request.post('/api/bogus').send({
        data: {
          type: 'bogus',
          attributes: {
            title: 'I am new'
          }
        }
      });
      expect(response.status).to.equal(403);
      expect(response.body).has.deep.property('errors[0].detail', '"bogus" is not a writable type');
    });

    it('gets 400 when creating a resource with no body', async function() {
      let response = await request.post('/api/articles');
      expect(response.status).to.equal(400);
      expect(response.body).has.deep.property('errors[0].detail', 'A body with a top-level "data" property is required');
    });

    it('gets 400 when creating a resource with no data property', async function() {
      let response = await request.post('/api/articles').send({datum: {}});
      expect(response.status).to.equal(400);
      expect(response.body).has.deep.property('errors[0].detail', 'A body with a top-level "data" property is required');
    });

    it('gets 404 when patching a missing resource', async function() {
      let version = await currentVersion(request, '/api/articles/0');

      let response = await request.patch('/api/articles/100').send({
        data: {
          id: '100',
          type: 'articles',
          attributes: {
            title: 'Updated title'
          },
          meta: { version }
        }
      });
      expect(response.status).to.equal(404);
      expect(response.body).has.deep.property('errors[0].detail', 'articles with id 100 does not exist');
    });

    it('refuses to delete without version', async function() {
      let response = await request.delete('/api/articles/0');
      expect(response).hasStatus(400);
      expect(response.body).has.deep.property('errors[0].detail', "version is required");
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
            title: 3
          }
        }
      });
      expect(response).hasStatus(400);
      expect(response.body.errors).length(2);
      expect(response.body.errors).collectionContains({
        title: 'Validation error',
        detail: '3 is not a valid value for field "title"',
        source: { pointer: '/data/attributes/title' }
      });
      expect(response.body.errors).collectionContains({
        title: 'Validation error',
        detail: 'the value of field "body" may not be null',
        source: { pointer: '/data/attributes/body' }
      });
    });

    it('validates schema during PATCH', async function() {
      let version = await currentVersion(request, '/api/articles/0');
      let response = await request.patch('/api/articles/0').send({
        data: {
          id: '0',
          type: 'articles',
          attributes: {
            title: 3
          },
          meta: { version }
        }
      });
      expect(response.status).to.equal(400);

      // we should not hit the body not-null constraint here, since
      // we're leaving it unchanged
      expect(response.body.errors).length(1);

      expect(response.body.errors).collectionContains({
        title: 'Validation error',
        detail: '3 is not a valid value for field "title"',
        source: { pointer: '/data/attributes/title' }
      });
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
            body: 'xxx'
          }
        }
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

    it('can create a new resource and not wait for indexing', async function() {
      let response = await request.post('/api/articles?nowait').send({
        data: {
          type: 'articles',
          attributes: {
            title: 'I am new',
            body: 'xxx'
          }
        }
      });

      expect(response).hasStatus(201);
      expect(response.headers).has.property('location');
      expect(response.body).has.deep.property('data.id');
      expect(response.body).has.deep.property('data.attributes.title', 'I am new');
      expect(response.body).has.deep.property('data.meta.version');

      response = await request.get(makeRelativeLink(response, response.headers.location));
      expect(response).hasStatus(404);
    });

    it('can update an existing resource', async function() {
      let version = await currentVersion(request, '/api/articles/0');

      let response = await request.patch('/api/articles/0').send({
        data: {
          id: '0',
          type: 'articles',
          attributes: {
            title: 'Updated title'
          },
          meta: { version }
        }
      });

      expect(response).hasStatus(200);
      expect(response).has.deep.property('body.data.attributes.title', 'Updated title');
      expect(response).has.deep.property('body.data.attributes.body', "This is the first article");

      response = await request.get('/api/articles/0');
      expect(response).hasStatus(200);
      expect(response).has.deep.property('body.data.attributes.title', 'Updated title', 'second time');
      expect(response).has.deep.property('body.data.attributes.body', "This is the first article", 'second time');

    });

    it('can delete a resource', async function() {
      let version = await currentVersion(request, '/api/articles/0');

      let response = await request.delete('/api/articles/0').set('If-Match', version);
      expect(response).hasStatus(204);

      response = await request.get('/api/articles/0');
      expect(response).hasStatus(404);
    });


  });

  describe("auth tests", function() {
    before(sharedSetup);
    after(sharedTeardown);

    it('applies authorization during create', async function() {
      await env.setUserId(null);
      let response = await request.post('/api/articles').send({
        data: {
          type: 'articles',
          attributes: {
            title: 'I am new',
            body: 'xxx'
          }
        }
      });
      expect(response.status).to.equal(401);
    });

    it('applies authorization during update', async function() {
      await env.setUserId(null);
      let version = await currentVersion(request, '/api/articles/0');
      let response = await request.patch('/api/articles/0').send({
        data: {
          id: '0',
          type: 'articles',
          attributes: {
            title: 'Updated title'
          },
          meta: { version }
        }
      });
      expect(response).hasStatus(401);
    });

    it('applies authorization during delete', async function() {
      await env.setUserId(null);
      let version = await currentVersion(request, '/api/articles/0');
      let response = await request.delete('/api/articles/0').set('If-Match', version);
      expect(response).hasStatus(401);
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
