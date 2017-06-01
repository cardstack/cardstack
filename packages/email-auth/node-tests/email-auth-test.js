const supertest = require('supertest');
const Koa = require('koa');
const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('@cardstack/test-support/env');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

describe('email-auth', function() {

  let request, env;

  async function setup() {
    let factory = new JSONAPIFactory();

    factory.addResource('plugin-configs').withAttributes({
      module: '@cardstack/authentication'
    });

    factory.addResource('plugin-configs').withAttributes({
      module: '@cardstack/email-auth'
    });

    factory.addResource('users').withAttributes({
      email: 'quint@example.com',
    });

    factory.addResource('authentication-sources', 'email-auth').withAttributes({
      authenticatorType: '@cardstack/email-auth',
      mayCreateUser: true,
      params: {}
    });

    factory.addResource('content-types', 'users').withRelated('fields', [
      factory.addResource('fields', 'email').withAttributes({
        fieldType: '@cardstack/core-types::string'
      })
    ]);

    env = await createDefaultEnvironment(`${__dirname}/..`, factory.getModels());
    let app = new Koa();
    app.use(env.lookup('hub:middleware-stack').middleware());
    app.use(async function(ctxt) {
      ctxt.set('Content-Type', 'application/json');
      ctxt.body = {};
      let session = ctxt.state.cardstackSession;
      if (session) {
        ctxt.body.userId = session.id;
        try {
          ctxt.body.user = await session.loadUser();
        } catch (err) {
          ctxt.body.user = { error: err };
        }
      }
    });
    request = supertest(app.callback());
  }

  async function teardown() {
    await destroyDefaultEnvironment(env);
  }

  beforeEach(setup);
  afterEach(teardown);

  it('creates a new user', async function() {
    let response = await request.post(`/auth/email-auth`).send({
      email: 'arthur@example.com'
    });
    expect(response).hasStatus(200);
    expect(response.body).has.deep.property('data.id');
    expect(response.body).has.deep.property('meta.token');

    await env.lookup('hub:indexers').update({ realTime: true });

    response = await request.get('/').set('authorization', `Bearer ${response.body.meta.token}`);
    expect(response).hasStatus(200);
    expect(response.body.user).has.property('type', 'users');
    expect(response.body.user.attributes).deep.equals({
      email: 'arthur@example.com',
    });
  });

  it('challenges returning user', async function() {
    let response = await request.post(`/auth/email-auth`).send({
      email: 'quint@example.com'
    });
    expect(response).hasStatus(200);
    expect(response.body).not.has.deep.property('meta.token');
    expect(response.body.data).deep.equals({
      type: 'partial-sessions',
      attributes: {
        message: 'Check your email',
        state: 'pending-email'
      }
    });
  });

});
