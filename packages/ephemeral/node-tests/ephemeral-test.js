const supertest = require('supertest');
const Koa = require('koa');
const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('@cardstack/test-support/env');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

describe('ephemeral-storage', function() {
  let env, request;

  beforeEach(async function() {
    let factory = new JSONAPIFactory();

    factory.addResource('plugin-configs').withAttributes({
      module: '@cardstack/ephemeral'
    });

    factory.addResource('plugin-configs').withAttributes({
      module: '@cardstack/jsonapi'
    });

    factory.addResource('plugin-configs')
      .withAttributes({
        module: "@cardstack/test-support/authenticator"
      });

    factory.addResource('content-types', 'posts').withRelated(
      'dataSource',
      factory.addResource('data-sources').withAttributes({
        sourceType: '@cardstack/ephemeral'
      })
    ).withRelated('fields', [
      factory.addResource('fields', 'title').withAttributes({
        fieldType: '@cardstack/core-types::string'
      })
    ]);

    env = await createDefaultEnvironment(__dirname + '/..', factory.getModels());

    let app = new Koa();
    app.use(env.lookup('hub:middleware-stack').middleware());
    request = supertest(app.callback());
  });

  afterEach(async function() {
    await destroyDefaultEnvironment(env);
  });

  it('can create a new record', async function() {
    let response = await request.post('/posts').send({
      data: {
        type: "posts",
        attributes: {
          title: "hello"
        }
      }
    });
    expect(response).hasStatus(201);
  });


});
