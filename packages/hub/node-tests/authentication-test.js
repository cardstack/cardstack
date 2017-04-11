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
        ctxt.body.user = await session.loadUser();
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
    let token = await auth.createToken({ userId: 42 }, -30);
    let response = await request.get('/').set('authorization', `Bearer ${token}`);
    expect(response.body).deep.equals({});
  });

  it('issues a working token', async function() {
    let token = await auth.createToken({ userId: env.user.id }, 30);
    let response = await request.get('/').set('authorization', `Bearer ${token}`);
    expect(response.body).has.property('userId', env.user.id);
  });

  it('offers full user load within session', async function() {
    let token = await auth.createToken({ userId: env.user.id }, 30);
    let response = await request.get('/').set('authorization', `Bearer ${token}`);
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

    it('finds configured authenticator', async function() {
      let response = await request.post(`/auth/${authenticatorName('stub')}`).send({});
      expect(response).hasStatus(400);
      expect(response.body.errors).collectionContains({
        detail: "password is required"
      });
    });

  });
});

function authenticatorName(shortName) {
  return encodeURIComponent(`@cardstack/hub/node-tests/stub-authenticators::${shortName}`)  ;
}
