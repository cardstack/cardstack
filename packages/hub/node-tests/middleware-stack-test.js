const JSONAPIFactory = require('../../../tests/stub-middleware/node_modules/@cardstack/test-support/jsonapi-factory');
const supertest = require('supertest');
const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('../../../tests/stub-middleware/node_modules/@cardstack/test-support/env');

describe('middleware-stack', function() {

  let env, request;

  async function setup() {
    let factory = new JSONAPIFactory();
    factory.addResource('plugin-configs', 'stub-middleware-extra').withAttributes({
      enabled: false
    });
    env = await createDefaultEnvironment(__dirname + '/../../../tests/stub-middleware', factory.getModels());
    let app = await env.makeApp(env);
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

    it('maintains order between middlewares even when the category they refer to is empty', async function() {
      let response = await request.get('/fourth');
      expect(response).hasStatus(200);

      // This is testing that 'third' runs before 'fourth', which
      // should be true because third is before:unused-tag and fourth
      // is after:unused-tag, even though there is no middleware
      // tagged with 'unused-tag'.
      expect(response.body.state).has.property('thirdRan');
    });

    it('does not respect x-forwarded-for by default', async function() {
      let response = await request.get('/ip').set('X-Forwarded-For', '4.3.2.1');
      expect(response).hasStatus(200);
      expect(response.body.ip).to.not.equal('4.3.2.1');
    });

  });

  describe('(dynamic)', function() {
    beforeEach(setup);
    afterEach(teardown);

    it('can dynamically mount more middleware', async function() {
      let config = await env.lookup('hub:searchers').get(env.session, 'master', 'plugin-configs', 'stub-middleware-extra');
      config.data.attributes.enabled = true;
      await env.lookup('hub:writers').update('master', env.session, config.data.type, config.data.id, config.data);
      await env.lookup('hub:indexers').update({ forceRefresh: true });
      let response = await request.get('/extra');
      expect(response).hasStatus(200);
      expect(response.body).has.property('message', 'Extra middleware plugin');
    });

    it('can dynamically remove middleware', async function() {
      await env.lookup('hub:writers').create('master', env.session, 'plugin-configs', {
        id: 'stub-middleware',
        type: 'plugin-configs',
        attributes: {
          enabled: false
        }
      });
      await env.lookup('hub:indexers').update({ forceRefresh: true });
      let response = await request.get('/first');
      expect(response).hasStatus(404);
    });
  });

  describe('when configured to trust proxy', function() {
    it('it uses x-forwarded-for header', async function() {
      let factory = new JSONAPIFactory();
      factory.addResource('plugin-configs', 'stub-middleware-extra').withAttributes({
        enabled: false
      });
      factory.addResource('plugin-configs', '@cardstack/hub').withAttributes({
        params: {
          'behind-trusted-proxy': true
        }
      });
      env = await createDefaultEnvironment(__dirname + '/../../../tests/stub-middleware', factory.getModels());
      let app = await env.makeApp();
      request = supertest(app.callback());
      let response = await request.get('/ip').set('X-Forwarded-For', '4.3.2.1');
      expect(response).hasStatus(200);
      expect(response.body.ip).to.equal('4.3.2.1');
    });

  });
});
