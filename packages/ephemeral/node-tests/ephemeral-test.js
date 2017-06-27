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

    let dataSource = factory.addResource('data-sources').withAttributes({
      sourceType: '@cardstack/ephemeral'
    });

    factory.addResource('content-types', 'posts').withRelated(
      'dataSource', dataSource
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

    factory.addResource('posts', 'second-post').withAttributes({
      title: 'The Second Post',
      body: 'Second post body'
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

  it('can create a checkpoint', async function() {
    let response = await request.post('/api/ephemeral-checkpoints').send({
      data: {
        type: 'ephemeral-checkpoints'
      }
    });
    expect(response).hasStatus(201);
  });

  it('checkpoint cannot be patched', async function() {
    let checkpoint = await request.post('/api/ephemeral-checkpoints').send({
      data: {
        type: 'ephemeral-checkpoints'
      }
    });
    expect(checkpoint).hasStatus(201);
    let response = await request.patch(`/api/ephemeral-checkpoints/${checkpoint.body.data.id}`).send(checkpoint.body);
    expect(response).hasStatus(400);
    expect(response.body.errors[0].detail).to.equal('ephemeral-checkpoints may not be patched');
  });

  it('checkpoint cannot be deleted', async function() {
    let checkpoint = await request.post('/api/ephemeral-checkpoints').send({
      data: {
        type: 'ephemeral-checkpoints'
      }
    });
    expect(checkpoint).hasStatus(201);
    let response = await request.delete(`/api/ephemeral-checkpoints/${checkpoint.body.data.id}`).set('If-Match', checkpoint.body.data.meta.version);
    expect(response).hasStatus(400);
    expect(response.body.errors[0].detail).to.equal('ephemeral-checkpoints may not be deleted');
  });


  it('can restore a checkpoint', async function() {

    // Grab initial records
    let first = await request.get('/api/posts/first-post');
    let second = await request.get('/api/posts/second-post');
    expect(first).hasStatus(200);
    expect(second).hasStatus(200);

    // Make a checkpoint
    let checkpoint = await request.post('/api/ephemeral-checkpoints').send({
      data: { type: 'ephemeral-checkpoints' }
    });
    expect(checkpoint).hasStatus(201);

    // Now do a post-checkpoint delete, patch, and post

    let response = await request.delete(`/api/posts/${first.body.data.id}`).set('If-Match', first.body.data.meta.version);
    expect(response).hasStatus(204);

    response = await request.patch(`/api/posts/${second.body.data.id}`).send({
      data: {
        attributes: {
          body: 'updated second body'
        },
        meta: {
          version: second.body.data.meta.version
        }
      }
    });
    expect(response).hasStatus(200);

    let third = await request.post(`/api/posts`).send({
      data: {
        type: "posts",
        attributes: {
          title: "third title"
        }
      }
    });
    expect(third).hasStatus(201);

    // Restore the checkpoint
    response = await request.post(`/api/ephemeral-restores`).send({
      data: {
        type: 'ephemeral-restores',
        relationships: {
          checkpoint: {
            data: { type: 'ephemeral-checkpoins', id: checkpoint.body.data.id }
          }
        }
      }
    });
    expect(response).hasStatus(201);

    // and see that our delete, patch, and post are undone
    response = await request.get('/api/posts/first-post');
    expect(response).hasStatus(200);

    response = await request.get('/api/posts/second-post');
    expect(response).hasStatus(200);
    expect(response.body.data.attributes.body).to.equal('Second post body');

    response = await request.get(`/api/posts/${third.body.data.id}`);
    expect(response).hasStatus(404);

  });

  it('can reset to empty', async function() {
    let response = await request.post('/api/ephemeral-restores').send({
      data: {
        type: 'ephemeral-restores',
        relationships: {
          checkpoint: {
            data: { type: 'ephemeral-restores', id: 'empty' }
          }
        }
      }
    });
    expect(response).hasStatus(201);
    response = await request.get('/api/posts/first-post');
    expect(response).hasStatus(404);
  });

});
