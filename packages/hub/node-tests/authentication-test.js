const supertest = require('supertest');
const Koa = require('koa');
const Authentication = require('@cardstack/hub/authentication');
const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('@cardstack/hub/node-tests/support');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
const crypto = require('crypto');

describe('hub/authentication', function() {

  let request, env, auth;

  before(async function() {
    let factory = new JSONAPIFactory();

    factory.addResource('plugin-configs').withAttributes({
      module: '@cardstack/hub/node-tests/stub-authenticators'
    });

    factory.addResource('content-types', 'users').withRelated('fields', [
      factory.addResource('fields', 'full-name').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
      factory.addResource('fields', 'email').withAttributes({
        fieldType: '@cardstack/core-types::string'
      })
    ]);

    factory.addResource('users', '58238').withAttributes({
      email: 'nobody@nowhere.com',
      fullName: "He's a real nowhere man"
    });

    env = await createDefaultEnvironment(factory.getModels());
    let key = crypto.randomBytes(32);
    let schema = await env.schemaCache.schemaForControllingBranch();
    auth = new Authentication(key, env.searcher, schema.plugins);
    let app = new Koa();
    app.use(auth.middleware());
    app.use(async function(ctxt) {
      ctxt.set('Content-Type', 'application/json');
      ctxt.body = {};
      let session = ctxt.state.cardstackSession;
      if (session) {
        ctxt.body.userId = session.userId;
        try {
          ctxt.body.user = await session.loadUser();
        } catch (err) {
          ctxt.body.user = { error: err };
        }
      }
    });
    request = supertest(app.callback());
  });

  after(async function() {
    await destroyDefaultEnvironment(env);
  });

  it('leaves user blank by default', async function() {
    let response = await request.get('/');
    expect(response.body).deep.equals({});
  });

  it('ignores a bogus token', async function() {
    await expectLogMessage(/Ignoring invalid token/, async () => {
      let response = await request.get('/').set('authorization', `Bearer xxx--yyy--zzz`);
      expect(response.body).deep.equals({});
    });
  });

  it('ignores expired token', async function() {
    let { token } = await auth.createToken({ userId: 42 }, -30);
    let response = await request.get('/').set('authorization', `Bearer ${token}`);
    expect(response.body).deep.equals({});
  });

  it('issues a working token', async function() {
    let { token } = await auth.createToken({ userId: env.user.id }, 30);
    let response = await request.get('/').set('authorization', `Bearer ${token}`);
    expect(response.body).has.property('userId', env.user.id);
  });

  it('offers full user load within session', async function() {
    let { token } = await auth.createToken({ userId: env.user.id }, 30);
    let response = await request.get('/').set('authorization', `Bearer ${token}`);
    debugger;
    expect(response.body.user).deep.equals(env.user);
  });

  describe('token endpoints', async function() {

    it('supports CORS preflight', async function() {
      let response = await request.options('/auth/foo');
      expect(response).hasStatus(200);
      expect(response.headers['access-control-allow-methods']).matches(/POST/);
    });

    it('supports CORS', async function() {
      await expectLogMessage(/No such authenticator foo/, async () => {
        let response = await request.post('/auth/foo').send({});
        expect(response.headers['access-control-allow-origin']).equals('*');
      });
    });

    it('returns not found for missing module', async function() {
      await expectLogMessage(/No such authenticator foo/, async () => {
        let response = await request.post('/auth/foo').send({});
        expect(response).hasStatus(404);
      });
    });

    it('finds authenticator', async function() {
      let response = await request.post(`/auth/${authenticatorName('unsafe')}`).send({ userId: env.user.id });
      expect(response).hasStatus(200);
    });

  });

  describe('authenticator plugin', function() {

    it('can approve via id', async function() {
      let response = await request.post(`/auth/${authenticatorName('unsafe')}`).send({
        userId: env.user.id
      });
      expect(response).hasStatus(200);
      expect(response.body).has.property('token');
      expect(response.body).has.property('validUntil');
      response = await request.get('/').set('authorization', `Bearer ${response.body.token}`);
      expect(response).hasStatus(200);
      expect(response.body).has.property('userId', env.user.id);
      expect(response.body.user).deep.equals(env.user);
    });

    it('can throw', async function() {
      let response = await request.post(`/auth/${authenticatorName('always-invalid')}`).send({});
      expect(response).hasStatus(400);
      expect(response.body.errors).collectionContains({
        detail: "Your input is terrible and you should feel bad"
      });
    });

    it('can reject by returning no id', async function() {
      let response = await request.post(`/auth/${authenticatorName('returns-no-id')}`).send({
      });
      expect(response).hasStatus(401);
    });

    it('can reject by returning nothing', async function() {
      let response = await request.post(`/auth/${authenticatorName('returns-nothing')}`).send({
      });
      expect(response).hasStatus(401);
    });

    it('can search for users', async function() {
      let response = await request.post(`/auth/${authenticatorName('by-email')}`).send({
        email: 'nobody@nowhere.com'
      });
      expect(response).hasStatus(200);
      expect(response.body).has.property('token');

      response = await request.get('/').set('authorization', `Bearer ${response.body.token}`);
      expect(response).hasStatus(200);
      expect(response.body).has.property('userId', '58238');
      expect(response.body.user).has.deep.property('attributes.full-name', "He's a real nowhere man");
    });

    it.skip('can create a new user', async function() {
      let response = await request.post(`/auth/${authenticatorName('writes-user')}`).send({
        id: 'x',
        type: 'users',
        attributes: {
          'full-name': 'Somebody Created'
        }
      });
      expect(response).hasStatus(200);
      expect(response.body).has.property('userId', 'x');
      expect(response.body.user).deep.equals({
        id: 'x',
        type: 'users',
        attributes: {
          'full-name': 'Somebody Created'
        }
      });

      await env.indexer.update({ realTime: true });

      let record = await env.searcher.get('master', 'users', 'x');
      expect(record).has.deep.property('attributes.full-name', 'Somebody Created');
    });

    it.skip('can update a user', async function() {
      let response = await request.post(`/auth/${authenticatorName('writes-user')}`).send({
        id: env.user.id,
        type: 'users',
        attributes: {
          email: 'updated.email@this-changed.com'
        }
      });
      expect(response).hasStatus(200);
      expect(response.body).has.property('userId', env.user.id);

      await env.indexer.update({ realTime: true });
      let record = await env.searcher.get('master', 'users', env.user.id);
      expect(record).has.deep.property('attributes.email', 'updated.email@this-changed.com');
      expect(record).has.deep.property('attributes.full-name', env.user.attributes['full-name']);
    });


  });
});

function authenticatorName(shortName) {
  return encodeURIComponent(`@cardstack/hub/node-tests/stub-authenticators::${shortName}`)  ;
}
