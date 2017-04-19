const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
const supertest = require('supertest');
const Koa = require('koa');
const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('./support');

describe('middleware-stack', function() {

  let env, request;

  beforeEach(async function() {
    let factory = new JSONAPIFactory();
    factory.addResource('plugin-configs')
      .withAttributes({
        module: '@cardstack/hub/node-tests/stub-middleware'
      });
    env = await createDefaultEnvironment(factory.getModels());
    let app = new Koa();
    app.use(env.lookup('hub:middleware-stack').middleware());
    request = supertest(app.callback());
  });

  afterEach(async function() {
    await destroyDefaultEnvironment(env);
  });

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
    expect(response.body.state).deep.equals({ wrapped: true });
  });

  it('placed "wrap" after "second"', async function() {
    let response = await request.get('/second');
    expect(response).hasStatus(200);
    expect(response.body.state).deep.equals({});
  });

});
