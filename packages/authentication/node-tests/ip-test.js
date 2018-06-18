const supertest = require('supertest');
const Koa = require('koa');
const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('@cardstack/test-support/env');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

describe('authentication/middleware/ip', function() {

  let request, env, auth;
  let ciSessionId = '1234567890';

  async function setup(callback) {
    let factory = new JSONAPIFactory();


    if(callback) {
      await callback(factory);
    }


    env = await createDefaultEnvironment(`${__dirname}/stub-authenticators`, factory.getModels(), { ciSessionId });
    let app = new Koa();
    app.use(env.lookup('hub:middleware-stack').middleware());
    app.use(async function(ctxt) {
      ctxt.set('Content-Type', 'application/json');
      ctxt.body = ctxt.state.cardstackSession && ctxt.state.cardstackSession.meta;
    });
    request = supertest(app.callback());
    auth = env.lookup('plugin-middleware:' + require.resolve('../cardstack/middleware'));
  }

  async function teardown() {
    await destroyDefaultEnvironment(env);
  }

  after(teardown);

  it('there is no session meta if there is no session', async function() {
    await setup();
    let response = await request.get('/');
    expect(response.body).deep.equals({});
  });

  it('has the ip in the session meta', async function() {
    await setup();
    let { token } = await auth.createToken({ id: env.user.data.id, type: 'test-users' }, 30);
    let response = await request.get('/').set('authorization', `Bearer ${token}`);
    expect(response.body).has.property('ip', "::ffff:127.0.0.1");
  });

  it('ignores the X-Forwarded-For header over the request ip if it is present and allow-x-forwarded-for is not configured', async function() {
    await setup();
    let { token } = await auth.createToken({ id: env.user.data.id, type: 'test-users' }, 30);
    let response = await request.get('/').set('authorization', `Bearer ${token}`).set('X-Forwarded-For', '8.8.8.8');

    expect(response.body).has.property('ip', "::ffff:127.0.0.1");
  });

  it('uses the X-Forwarded-For header over the request ip if it is present and allow-x-forwarded-for is configured to be allowed', async function() {
    await setup((factory) => {
      factory.addResource('plugin-configs', '@cardstack/authentication')
        .withAttributes({
          'plugin-config': {
            'allow-x-forwarded-for': true
          }
        });
    });

    let { token } = await auth.createToken({ id: env.user.data.id, type: 'test-users' }, 30);

    let response = await request.get('/').set('authorization', `Bearer ${token}`).set('X-Forwarded-For', '8.8.8.8');
    expect(response.body).has.property('ip', "8.8.8.8");
  });

});
