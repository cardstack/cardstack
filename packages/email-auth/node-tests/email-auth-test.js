const supertest = require('supertest');
const Koa = require('koa');
const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('@cardstack/test-support/env');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
const TestMessenger = require('@cardstack/test-support/messenger/messenger');

describe('email-auth', function() {

  let request, env;

  async function setup() {
    let factory = new JSONAPIFactory();

    factory.addResource('plugin-configs', '@cardstack/authentication');

    factory.addResource('plugin-configs', '@cardstack/email-auth');

    factory.addResource('plugin-configs', '@cardstack/test-support/messenger');

    factory.addResource('users', 'valid-quint-id').withAttributes({
      email: 'quint@example.com',
    });

    factory.addResource('message-sinks', 'the-sink').withAttributes({
      messengerType: '@cardstack/test-support/messenger'
    });

    factory.addResource('authentication-sources', 'email-auth').withAttributes({
      authenticatorType: '@cardstack/email-auth',
      mayCreateUser: true,
      params: {
        messageSinkId: 'the-sink'
      }
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

  it('requires referer', async function() {
    let response = await request.post(`/auth/email-auth`).send({
      email: 'quint@example.com'
    });
    expect(response).hasStatus(400);
  });

  it('challenges returning user', async function() {
    let response = await request.post(`/auth/email-auth`).send({
      email: 'quint@example.com',
      referer: 'http://example.com'
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
    let sentMessages = await TestMessenger.sentMessages(env);
    expect(sentMessages).has.length(1, 'sent messages has the wrong length');
    expect(sentMessages[0]).has.deep.property('message.subject');
    expect(sentMessages[0].message.text).to.match(/http:\/\/example\.com\/@cardstack\/email-auth\/redirect.html\?secret=...../);
  });

  it('allows returning user with valid token', async function() {
    let response = await request.post(`/auth/email-auth`).send({
      email: 'quint@example.com',
      referer: 'http://example.com'
    });
    expect(response).hasStatus(200);
    expect(response.body).has.deep.property('data.attributes.state', 'pending-email');
    let sentMessages = await TestMessenger.sentMessages(env);
    expect(sentMessages).has.length(1);
    let m = /http:\/\/example\.com\/@cardstack\/email-auth\/redirect.html\?secret=(.*)/.exec(sentMessages[0].message.text);
    expect(m).is.ok;
    let secret = decodeURIComponent(m[1]);
    response = await request.post('/auth/email-auth').send({ secret });
    expect(response).hasStatus(200);
    expect(response.body.data).has.property('type', 'users');
    expect(response.body.data.attributes).deep.equals({
      email: 'quint@example.com',
    });
  });

  it('rejects malformed token', async function() {
    let response = await request.post(`/auth/email-auth`).send({
      secret: 'not-a-thing',
    });
    expect(response).hasStatus(401);
  });

  it('rejects valid but expired token', async function() {
    let token = env.lookup('hub:encryptor').encryptAndSign(['valid-quint-id', Math.floor(Date.now()/1000 - 60)]);
    let response = await request.post(`/auth/email-auth`).send({
      secret: token
    });
    expect(response).hasStatus(401);
  });

  it('rejects valid token for missing user', async function() {
    let token = env.lookup('hub:encryptor').encryptAndSign(['not-valid-id', Math.floor(Date.now()/1000 + 60)]);
    let response = await request.post(`/auth/email-auth`).send({
      secret: token
    });
    expect(response).hasStatus(404);
  });

  it('matches the token format our tests expect', async function() {
    let token = env.lookup('hub:encryptor').encryptAndSign(['valid-quint-id', Math.floor(Date.now()/1000 + 60)]);
    let response = await request.post(`/auth/email-auth`).send({
      secret: token
    });
    expect(response).hasStatus(200);
    expect(response.body.data.attributes).deep.equals({
      email: 'quint@example.com',
    });
  });

});
