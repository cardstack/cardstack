
const supertest = require('supertest');
const Koa = require('koa');
const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('@cardstack/test-support/env');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

describe('authentication/schema-authorization', function() {
  let request, env, user, authorizedUser, unauthorizedUser;

  async function setup() {
    let factory = new JSONAPIFactory();

    factory.addResource('grants')
      .withRelated('who', { type: 'groups', id: 'authorized-user' })
      .withAttributes({
        mayLogin: true
      });
    factory.addResource('grants')
      .withRelated('who', { type: 'groups', id: 'unauthorized-user' })
      .withAttributes({
        mayLogin: false
      });
    factory.addResource('grants')
      .withRelated('who', { type: 'groups', id: 'user' });

    user = factory.addResource('test-users', 'user').withAttributes({
      email: 'vangogh@example.com',
      fullName: "Van Gogh"
    });
    unauthorizedUser = factory.addResource('test-users', 'unauthorized-user').withAttributes({
      email: 'hassan@example.com',
      fullName: "Hassan Abdel-Rahman"
    });
    authorizedUser = factory.addResource('test-users', 'authorized-user').withAttributes({
      email: 'ringo@example.com',
      fullName: "Ringo Abdel-Rahman"
    });

    factory.addResource('data-sources', 'echo').withAttributes({
      sourceType: 'stub-authenticators::echo'
    });

    env = await createDefaultEnvironment(`${__dirname}/stub-authenticators`, factory.getModels());
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

  describe('mayLogin authorization', function() {

    before(setup);
    after(teardown);

    it('authorizes a user with a grant that has a `mayLogin` attribute set to true to be allowed to login', async function() {
      let response = await request.post(`/auth/echo`).send({
        data: { id: authorizedUser.id, type: 'test-users' }
      });
      expect(response).hasStatus(200);
      expect(response.body).has.deep.property('data.meta.token');
      expect(response.body).has.deep.property('data.meta.validUntil');
    });

    it('does not authorize a user with a grant that has a `mayLogin` attribute set to false to be allowed to login', async function() {
      let response = await request.post(`/auth/echo`).send({
        data: { id: unauthorizedUser.id, type: 'test-users' }
      });
      expect(response).hasStatus(401);
      expect(response.body).deep.equal({
        errors: [{
          title: 'Not authorized',
          detail: 'You do not posses a grant that authorizes you to login'
        }]
      });
    });

    it('defaults to not authorizing a user to be able to login when the `mayLogin` attribute is not specified', async function() {
      let response = await request.post(`/auth/echo`).send({
        data: { id: user.id, type: 'test-users' }
      });
      expect(response).hasStatus(401);
      expect(response.body).deep.equal({
        errors: [{
          title: 'Not authorized',
          detail: 'You do not posses a grant that authorizes you to login'
        }]
      });
    });
  });
});
