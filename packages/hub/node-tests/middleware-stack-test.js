const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
const supertest = require('supertest');
const Koa = require('koa');
const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('./support');

describe('middleware-stack', function() {

  let env, request;

  async function setup() {
    let factory = new JSONAPIFactory();
    factory.addResource('plugin-configs')
        .withAttributes({
          module: '@cardstack/hub/node-tests/stub-middleware'
        });
    env = await createDefaultEnvironment(factory.getModels());
    let app = new Koa();
    app.use(env.lookup('hub:middleware-stack').middleware());
    request = supertest(app.callback());
  }

  async function teardown() {
    await destroyDefaultEnvironment(env);
  }

  describe('(static)', function() {
    before(setup);
    after(teardown);

    it('mounts first stub middleware', async function() {
      let response = await request.get('/first');
      expect(response).hasStatus(200);
      expect(response.body).has.property('message', 'First middleware plugin');
    });

    it('mounts second stub middleware', async function() {
      let response = await request.get('/second');
      expect(response).hasStatus(200);
      expect(response.body).has.property('message', 'Second middleware plugin');
    });

    it('placed "wrap" before "first"', async function() {
      let response = await request.get('/first');
      expect(response).hasStatus(200);
      expect(response.body.state).has.property('wrapped', true);
    });

    it('placed "wrap" after "second"', async function() {
      let response = await request.get('/second');
      expect(response).hasStatus(200);
      expect(response.body.state).not.has.property('wrapped');
    });

    it('does not mount unconfigured middleware', async function() {
      let response = await request.get('/extra');
      expect(response).hasStatus(404);
    });

  });

  describe('(dynamic)', function() {
    beforeEach(setup);
    afterEach(teardown);

    it('can dynamically mount more middleware', async function() {
      await env.lookup('hub:writers').create('master', env.user, 'plugin-configs', {
        type: 'plugin-configs',
        attributes: {
          module: '@cardstack/hub/node-tests/stub-middleware-extra'
        }
      });
      await env.lookup('hub:indexers').update({ realTime: true });
      let response = await request.get('/extra');
      expect(response).hasStatus(200);
      expect(response.body).has.property('message', 'Extra middleware plugin');
    });

    it('can dynamically remove middleware', async function() {
      let configs = await env.lookup('hub:searchers').search('master', { filter: { module: { exact: '@cardstack/hub/node-tests/stub-middleware' } } });
      expect(configs.models).length(1);
      let config = configs.models[0];
      await env.lookup('hub:writers').delete('master', env.user, config.meta.version, config.type, config.id);
      await env.lookup('hub:indexers').update({ realTime: true });
      let response = await request.get('/first');
      expect(response).hasStatus(404);
    });

  });
});
