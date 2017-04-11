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

  let request, env, auth, quint, arthur;

  before(async function() {
    let factory = new JSONAPIFactory();

    factory.addResource('plugin-configs').withAttributes({
      module: '@cardstack/hub/node-tests/stub-authenticators'
    });

    quint = factory.addResource('users').withAttributes({
      email: 'quint@example.com',
      fullName: "Quint Faulkner"
    });

    arthur = factory.addResource('users', 'a-1').withAttributes({
      email: 'arthur@example.com',
      fullName: "Arthur Faulkner"
    });

    factory.addResource('authentication-sources', 'echo').withAttributes({
      authenticatorType: '@cardstack/hub/node-tests/stub-authenticators::echo'
    });

    factory.addResource('authentication-sources', 'returns-nothing').withAttributes({
      authenticatorType: '@cardstack/hub/node-tests/stub-authenticators::returns-nothing'
    });

    factory.addResource('authentication-sources', 'by-email').withAttributes({
      authenticatorType: '@cardstack/hub/node-tests/stub-authenticators::by-email'
    });

    factory.addResource('authentication-sources', 'always-invalid').withAttributes({
      authenticatorType: '@cardstack/hub/node-tests/stub-authenticators::always-invalid'
    });

    factory.addResource('authentication-sources', 'config-echo-quint').withAttributes({
      authenticatorType: '@cardstack/hub/node-tests/stub-authenticators::config-echo',
      params: {
        userId: quint.id
      }
    });

    factory.addResource('authentication-sources', 'config-echo-arthur').withAttributes({
      authenticatorType: '@cardstack/hub/node-tests/stub-authenticators::config-echo',
      params: {
        userId: arthur.id
      }
    });

    factory.addResource('authentication-sources', 'id-rewriter').withAttributes({
      authenticatorType: '@cardstack/hub/node-tests/stub-authenticators::echo',
      userTemplate: '{ "id": "a-{{userId}}" }'
    });

    factory.addResource('content-types', 'users').withRelated('fields', [
      factory.addResource('fields', 'full-name').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
      factory.addResource('fields', 'email').withAttributes({
        fieldType: '@cardstack/core-types::string'
      })
    ]);


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


  it('token comes with validity timestamp', async function() {
    let { validUntil } = await auth.createToken({ userId: env.user.id }, 30);
    expect(validUntil).is.a('number');
  });

  it('offers full user load within session', async function() {
    let { token } = await auth.createToken({ userId: env.user.id }, 30);
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
      let response = await request.post('/auth/foo').send({});
      expect(response.headers['access-control-allow-origin']).equals('*');
    });

    it('returns not found for missing module', async function() {
      let response = await request.post('/auth/foo').send({});
      expect(response).hasStatus(404);
    });

    it('finds authenticator', async function() {
      let response = await request.post(`/auth/echo`).send({ userId: env.user.id });
      expect(response).hasStatus(200);
    });

    it('responds with token', async function() {
      let response = await request.post(`/auth/echo`).send({ userId: env.user.id });
      expect(response).hasStatus(200);
      expect(response.body.token).is.a('string');
    });

    it('responds with validity timestamp', async function() {
      let response = await request.post(`/auth/echo`).send({ userId: env.user.id });
      expect(response).hasStatus(200);
      expect(response.body.validUntil).is.a('number');
    });

    it('responds with a copy of the user record', async function() {
      let response = await request.post(`/auth/echo`).send({ userId: env.user.id });
      expect(response).hasStatus(200);
      expect(response.body.user).deep.equals(env.user);
    });

  });

  describe('token issuers', function() {

    it('can run with multiple configs', async function() {
      let response = await request.post(`/auth/config-echo-quint`).send({
        userId: 'ignored'
      });
      expect(response).hasStatus(200);
      expect(response.body).has.deep.property('user.id', quint.id);

      response = await request.post(`/auth/config-echo-arthur`).send({
        userId: 'ignored'
      });
      expect(response).hasStatus(200);
      expect(response.body).has.deep.property('user.id', arthur.id);
    });

    it('can approve via id', async function() {
      let response = await request.post(`/auth/echo`).send({
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
      let response = await request.post(`/auth/always-invalid`).send({});
      expect(response).hasStatus(400);
      expect(response.body.errors).collectionContains({
        detail: "Your input is terrible and you should feel bad"
      });
    });

    it('can reject by returning no id', async function() {
      let response = await request.post(`/auth/echo`).send({
      });
      expect(response).hasStatus(401);
    });

    it('can reject by returning nothing', async function() {
      let response = await request.post(`/auth/returns-nothing`).send({
      });
      expect(response).hasStatus(401);
    });

    it('can search for users', async function() {
      let response = await request.post(`/auth/by-email`).send({
        email: 'quint@example.com'
      });
      expect(response).hasStatus(200);
      expect(response.body).has.property('token');
      expect(response.body).has.deep.property('user.id', quint.id);
      response = await request.get('/').set('authorization', `Bearer ${response.body.token}`);
      expect(response).hasStatus(200);
      expect(response.body).has.property('userId', quint.id);
      expect(response.body.user).has.deep.property('attributes.full-name', "Quint Faulkner");
    });

    it('can provide preloaded user', async function() {
      let response = await request.post(`/auth/echo`).send({
        userId: 'x',
        preloadedUser: {
          id: 'x',
          type: 'users',
          attributes: {
            'full-name': 'Mr X'
          }
        }
      });
      expect(response).hasStatus(200);

      // this is exercising the preloadedUser API because this user
      // doesn't exist in the search index, so if Authentication
      // itself tries to do the load it will fail.
      expect(response.body).has.deep.property('user.attributes.full-name', 'Mr X');
    });

    it.skip('can create a new user', async function() {
      let response = await request.post(`/auth/echo`).send({
        userId: '4321',
        details: {
          firstName: 'Arthur',
          lastName: 'Faulkner'
        }
      });
      expect(response).hasStatus(200);
      expect(response.body).has.property('token');

      await env.indexer.update({ realTime: true });

      response = await request.get('/').set('authorization', `Bearer ${response.body.token}`);
      expect(response).hasStatus(200);
      expect(response.body.userId).equals('my-prefix/4321');
      expect(response.body.user).deep.equals({
        id: 'my-prefix/4321',
        type: 'users',
        attributes: {
          'full-name': 'Arthur Faulkner'
        }
      });
    });

    it('applies userTemplate to rewrite ids', async function() {
      let response = await request.post(`/auth/id-rewriter`).send({
        userId: '1'
      });
      expect(response).hasStatus(200);
      expect(response.body).has.deep.property('user.id', 'a-1');
      expect(response.body).has.deep.property('user.attributes.full-name', 'Arthur Faulkner');
    });

    it('applies userTemplate to rewrite ids', async function() {
      let response = await request.post(`/auth/id-rewriter`).send({
        userId: '1'
      });
      expect(response).hasStatus(200);
      expect(response.body).has.deep.property('user.id', 'a-1');
      expect(response.body).has.deep.property('user.attributes.full-name', 'Arthur Faulkner');
    });

    it.skip('ignores user create when not configured', async function() {
      let response = await request.post(`/auth/id-rewriter`).send({
        userId: '4321',
        details: {
          firstName: 'New',
          lastName: 'Person'
        }
      });
      expect(response).hasStatus(200);
      expect(response.body).has.property('token');
      expect(response.body).has.deep.property('user.id', 'my-prefix/4321');

      await env.indexer.update({ realTime: true });

      response = await request.get('/').set('authorization', `Bearer ${response.body.token}`);
      expect(response).hasStatus(200);
      expect(response.body.user).has.property('error');
      expect(response.body.userId).equals('my-prefix/4321');
    });

    it.skip('can update a user', async function() {
      let response = await request.post(`/auth/echo`).send({
        userId: env.user.id,
        details: {
         email: 'updated.email@this-changed.com'
        }
      });
      expect(response).hasStatus(200);
      expect(response.body).has.property('token');

      await env.indexer.update({ realTime: true });

      response = await request.get('/').set('authorization', `Bearer ${response.body.token}`);
      expect(response).hasStatus(200);
      expect(response.body.userId).equals(env.user.id);
      expect(response.body.user).deep.equals({
        id: env.user.id,
        type: 'users',
        attributes: Object.assign({}, env.user.attributes, { email: 'updated.email@this-changed.com' })
      });
    });

    it('ignores user update when not configured', async function() {
      let response = await request.post(`/auth/echo`).send({
        userId: env.user.id,
        details: {
         email: 'updated.email@this-changed.com'
        }
      });
      expect(response).hasStatus(200);
      expect(response.body).has.property('token');

      await env.indexer.update({ realTime: true });

      response = await request.get('/').set('authorization', `Bearer ${response.body.token}`);
      expect(response).hasStatus(200);
      expect(response.body.userId).equals(env.user.id);
      expect(response.body.user).deep.equals({
        id: env.user.id,
        type: 'users',
        attributes: Object.assign({}, env.user.attributes)
      });
    });



  });
});
