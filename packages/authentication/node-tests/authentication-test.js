const supertest = require('supertest');
const Koa = require('koa');
const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('@cardstack/hub/node-tests/support');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

describe('authentication/middleware', function() {

  let request, env, auth, quint, arthur;

  async function setup() {
    let factory = new JSONAPIFactory();

    factory.addResource('plugin-configs').withAttributes({
      module: '@cardstack/authentication'
    });

    factory.addResource('plugin-configs').withAttributes({
      module: '@cardstack/authentication/node-tests/stub-authenticators'
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
      authenticatorType: '@cardstack/authentication/node-tests/stub-authenticators::echo'
    });

    factory.addResource('authentication-sources', 'returns-nothing').withAttributes({
      authenticatorType: '@cardstack/authentication/node-tests/stub-authenticators::returns-nothing'
    });

    factory.addResource('authentication-sources', 'by-email').withAttributes({
      authenticatorType: '@cardstack/authentication/node-tests/stub-authenticators::by-email',
      params: {
        hidden: true
      }
    });

    factory.addResource('authentication-sources', 'always-invalid').withAttributes({
      authenticatorType: '@cardstack/authentication/node-tests/stub-authenticators::always-invalid'
    });

    factory.addResource('authentication-sources', 'config-echo-quint').withAttributes({
      authenticatorType: '@cardstack/authentication/node-tests/stub-authenticators::config-echo',
      params: {
        user: { id: quint.id, type: 'users' }
      }
    });

    factory.addResource('authentication-sources', 'config-echo-arthur').withAttributes({
      authenticatorType: '@cardstack/authentication/node-tests/stub-authenticators::config-echo',
      params: {
        user: { id: arthur.id, type: 'users' }
      }
    });

    factory.addResource('authentication-sources', 'id-rewriter').withAttributes({
      authenticatorType: '@cardstack/authentication/node-tests/stub-authenticators::echo',
      userTemplate: '{ "id": "{{upstreamId}}", "type": "users" }'
    });

    factory.addResource('authentication-sources', 'has-default-template').withAttributes({
      authenticatorType: '@cardstack/authentication/node-tests/stub-authenticators::has-default-template'
    });


    factory.addResource('authentication-sources', 'create-via-template').withAttributes({
      authenticatorType: '@cardstack/authentication/node-tests/stub-authenticators::echo',
      userTemplate: `{
        "id": "my-prefix-{{id}}",
        "type": "users",
        "attributes": {
          "full-name": "{{firstName}} {{lastName}}",
          "email": "{{email}}"
        }
      }`,
      mayCreateUser: true
    });

    factory.addResource('authentication-sources', 'update-user').withAttributes({
      authenticatorType: '@cardstack/authentication/node-tests/stub-authenticators::echo',
      mayUpdateUser: true
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
    auth = env.lookup('middleware:' + require.resolve('@cardstack/authentication/cardstack/middleware'));
  }

  async function teardown() {
    await destroyDefaultEnvironment(env);
  }

  describe('(read)', function() {

    before(setup);
    after(teardown);

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
      let { token } = await auth.createToken({ id: 42, type: 'users' }, -30);
      let response = await request.get('/').set('authorization', `Bearer ${token}`);
      expect(response.body).deep.equals({});
    });

    it('issues a working token', async function() {
      let { token } = await auth.createToken({ id: env.user.id, type: 'users' }, 30);
      let response = await request.get('/').set('authorization', `Bearer ${token}`);
      expect(response.body).has.property('userId', env.user.id);
    });


    it('token comes with validity timestamp', async function() {
      let { validUntil } = await auth.createToken({ id: env.user.id, type: 'users' }, 30);
      expect(validUntil).is.a('number');
    });

    it('offers full user load within session', async function() {
      let { token } = await auth.createToken({ id: env.user.id, type: 'users' }, 30);
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
        let response = await request.post(`/auth/echo`).send({ user: {id : env.user.id, type: 'users' }});
        expect(response).hasStatus(200);
      });

      it('responds with token', async function() {
        let response = await request.post(`/auth/echo`).send({ user: { id: env.user.id, type: 'users' }});
        expect(response).hasStatus(200);
        expect(response.body.meta.token).is.a('string');
      });

      it('responds with validity timestamp', async function() {
        let response = await request.post(`/auth/echo`).send({ user: { id: env.user.id, type: 'users' }});
        expect(response).hasStatus(200);
        expect(response.body.meta.validUntil).is.a('number');
      });

      it('responds with a copy of the user record', async function() {
        let response = await request.post(`/auth/echo`).send({ user: { id: env.user.id, type: 'users' }});
        expect(response).hasStatus(200);
        expect(response.body.data).deep.equals(env.user);
      });

    });

    describe('token issuers', function() {

      it('can run with multiple configs', async function() {
        let response = await request.post(`/auth/config-echo-quint`).send({
          user: 'ignored'
        });
        expect(response).hasStatus(200);
        expect(response.body).has.deep.property('data.id', quint.id);

        response = await request.post(`/auth/config-echo-arthur`).send({
          user: 'ignored'
        });
        expect(response).hasStatus(200);
        expect(response.body).has.deep.property('data.id', arthur.id);
      });

      it('can approve via id', async function() {
        let response = await request.post(`/auth/echo`).send({
          user: { id: env.user.id, type: 'users' }
        });
        expect(response).hasStatus(200);
        expect(response.body).has.deep.property('meta.token');
        expect(response.body).has.deep.property('meta.validUntil');
        response = await request.get('/').set('authorization', `Bearer ${response.body.meta.token}`);
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
        expect(response.body).has.deep.property('meta.token');
        expect(response.body).has.deep.property('data.id', quint.id);
        response = await request.get('/').set('authorization', `Bearer ${response.body.meta.token}`);
        expect(response).hasStatus(200);
        expect(response.body).has.property('userId', quint.id);
        expect(response.body.user).has.deep.property('attributes.full-name', "Quint Faulkner");
      });

      it('can provide preloaded user', async function() {
        let response = await request.post(`/auth/echo`).send({
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
        expect(response.body).has.deep.property('data.attributes.full-name', 'Mr X');
      });

      it('applies userTemplate to rewrite ids', async function() {
        let response = await request.post(`/auth/id-rewriter`).send({
          user: { upstreamId: arthur.id }
        });
        expect(response).hasStatus(200);
        expect(response.body).has.deep.property('data.id', arthur.id);
        expect(response.body).has.deep.property('data.attributes.full-name', 'Arthur Faulkner');
      });


      it('ignores user update when not configured', async function() {
        let response = await request.post(`/auth/echo`).send({
          user: {
            id: quint.id,
            type: 'users',
            attributes: {
              email: 'updated.email@this-changed.com'
            }
          }
        });
        expect(response).hasStatus(200);
        expect(response.body).has.deep.property('meta.token');
        expect(response.body).has.deep.property('data.attributes.email', 'quint@example.com');

        await env.lookup('hub:indexers').update({ realTime: true });

        response = await request.get('/').set('authorization', `Bearer ${response.body.meta.token}`);
        expect(response).hasStatus(200);
        expect(response.body.userId).equals(quint.id);
        expect(response.body.user).has.property('id', quint.id);
        expect(response.body.user).has.property('type', 'users');
        expect(response.body.user.attributes).deep.equals({
          'full-name': 'Quint Faulkner',
          email: 'quint@example.com'
        });
      });

      it('when create not configured, returns 401', async function() {
        let response = await request.post(`/auth/echo`).send({
          user: {
            id: 'my-prefix-4321',
            type: 'users',
            attributes: {
              'full-name': 'Newly Created',
              email: 'new@example.com'
            }
          }
        });
        expect(response).hasStatus(401);
      });

      it('when plugin returns no type, returns 401', async function() {
        let response = await request.post(`/auth/echo`).send({
          user: {
            id: 'my-prefix-4321',
            attributes: {
              'full-name': 'Newly Created',
              email: 'new@example.com'
            }
          }
        });
        expect(response).hasStatus(401);
      });

      it('can choose to expose some configuration', async function() {
        let response = await request.get('/auth/config-echo-quint');
        expect(response.body).deep.equals({
          user: { id: quint.id, type: 'users' }
        });
      });


      it('does not expose config unless opted in', async function() {
        let response = await request.get('/auth/by-email');
        expect(response.body).deep.equals({});
      });

      it(`applies plugin's default template to rewrite ids`, async function() {
        let response = await request.post(`/auth/has-default-template`).send({
          user: { upstreamId: arthur.id }
        });
        expect(response).hasStatus(200);
        expect(response.body).has.deep.property('data.id', arthur.id);
        expect(response.body).has.deep.property('data.attributes.full-name', 'Arthur Faulkner');
      });
    });
  });

  describe('(read/write)', function() {
    describe('token issuers', function() {
      beforeEach(setup);
      afterEach(teardown);

      it('can update a user', async function() {
        let response = await request.post(`/auth/update-user`).send({
          user: {
            id: quint.id,
            type: 'users',
            attributes: {
              email: 'updated.email@this-changed.com'
            }
          }
        });
        expect(response).hasStatus(200);
        expect(response.body).has.deep.property('meta.token');
        expect(response.body).has.deep.property('data.attributes.email', 'updated.email@this-changed.com');

        await env.lookup('hub:indexers').update({ realTime: true });

        response = await request.get('/').set('authorization', `Bearer ${response.body.meta.token}`);
        expect(response).hasStatus(200);
        expect(response.body.userId).equals(quint.id);
        expect(response.body.user).has.property('id', quint.id);
        expect(response.body.user).has.property('type', 'users');
        expect(response.body.user.attributes).deep.equals({
          'full-name': 'Quint Faulkner',
          email: 'updated.email@this-changed.com'
        });
      });

      it('can create a new user', async function() {
        let response = await request.post(`/auth/create-via-template`).send({
          user: {
            id: '4321',
            firstName: 'Newly',
            lastName: 'Created',
            email: 'new@example.com'
          }
        });
        expect(response).hasStatus(200);
        expect(response.body).has.deep.property('meta.token');

        await env.lookup('hub:indexers').update({ realTime: true });

        response = await request.get('/').set('authorization', `Bearer ${response.body.meta.token}`);
        expect(response).hasStatus(200);
        expect(response.body.userId).equals('my-prefix-4321');
        expect(response.body.user).has.property('id', 'my-prefix-4321');
        expect(response.body.user).has.property('type', 'users');
        expect(response.body.user.attributes).deep.equals({
          email: 'new@example.com',
          'full-name': 'Newly Created'
        });
      });
    });
  });
});
