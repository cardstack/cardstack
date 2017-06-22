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
      }),
      factory.addResource('fields', 'body').withAttributes({
        fieldType: '@cardstack/core-types::string'
      })
    ]);

    factory.addResource('posts', 'first-post').withAttributes({
      title: 'The First Post',
      body: 'First post body'
    });

    env = await createDefaultEnvironment(__dirname + '/..', factory.getModels());

    let app = new Koa();
    app.use(env.lookup('hub:middleware-stack').middleware());
    request = supertest(app.callback());
  });

  afterEach(async function() {
    await destroyDefaultEnvironment(env);
  });

  it('can create a new record', async function() {
    let response = await request.post('/api/posts').send({
      data: {
        type: "posts",
        attributes: {
          title: "hello"
        }
      }
    });
    expect(response).hasStatus(201);
    expect(response.body).has.deep.property('data.meta.version');
    expect(response.body).has.deep.property('data.id');
    expect(response.body.data.id).is.ok;

    await env.lookup('hub:indexers').update({ realTime: true });

    response = await request.get(`/api/posts/${response.body.data.id}`);
    expect(response).hasStatus(200);
    expect(response.body).has.deep.property('data.attributes.title', 'hello');
  });

  it('can update a record', async function() {
    let response = await request.get('/api/posts/first-post');
    expect(response).hasStatus(200);
    expect(response.body).has.deep.property('data.meta.version');
    response = await request.patch('/api/posts/first-post').send({
      data: {
        attributes: {
          body: 'Updated body'
        },
        meta: {
          version: response.body.data.meta.version
        }
      }
    });
    expect(response).hasStatus(200);
    expect(response.body.data.attributes).deep.equals({
      body: 'Updated body',
      title: 'The First Post'
    });

    await env.lookup('hub:indexers').update({ realTime: true });

    response = await request.get('/api/posts/first-post');
    expect(response).hasStatus(200);
    expect(response.body.data.attributes).deep.equals({
      body: 'Updated body',
      title: 'The First Post'
    });
  });

  it('enforces meta.version consistency during update', async function() {
    let response = await request.get('/api/posts/first-post');
    expect(response).hasStatus(200);
    expect(response.body).has.deep.property('data.meta.version');
    response = await request.patch('/api/posts/first-post').send({
      data: {
        attributes: {
          body: 'Updated body'
        },
        meta: {
          version: 'not valid'
        }
      }
    });
    expect(response).hasStatus(409);
  });


  it('can delete a record', async function() {
    let response = await request.get('/api/posts/first-post');
    expect(response).hasStatus(200);
    expect(response.body).has.deep.property('data.meta.version');
    response = await request.delete('/api/posts/first-post').set('If-Match', response.body.data.meta.version);
    expect(response).hasStatus(204);

    await env.lookup('hub:indexers').update({ realTime: true });

    response = await request.get('/api/posts/first-post');
    expect(response).hasStatus(404);
  });


  it('enforces meta.version consistency during delete', async function() {
    let response = await request.get('/api/posts/first-post');
    expect(response).hasStatus(200);
    expect(response.body).has.deep.property('data.meta.version');
    response = await request.delete('/api/posts/first-post').set('If-Match', 'not-valid');
    expect(response).hasStatus(409);
  });

});
