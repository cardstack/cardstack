/*
   Because @cardstack/test-support depends on us, we can't depend
   directly on @cardstack/test-support. Instead we have a test-app
   that depends on it.
*/

const supertest = require('supertest');
const defaults = require('superagent-defaults');
const Koa = require('koa');
const {
  createDefaultEnvironment,
  destroyDefaultEnvironment,
} = require('../../../tests/ephemeral-test-app/node_modules/@cardstack/test-support/env');
const JSONAPIFactory = require('../../../tests/ephemeral-test-app/node_modules/@cardstack/test-support/jsonapi-factory');
const { defaultDataSourceId } = require('@cardstack/test-support/env');

describe('ephemeral-storage', function() {
  let env, request, ephemeralService;

  async function setup() {
    let factory = new JSONAPIFactory();
    factory.addResource('posts', 'initial').withAttributes({ title: 'initial post' });
    factory.addResource('content-types', 'extra-things').withRelated('fields', [
      factory.addResource('fields', 'extra-field').withAttributes({
        fieldType: '@cardstack/core-types::string',
      }),
    ]);

    factory.addResource('posts', 'first-post').withAttributes({
      title: 'The First Post',
      body: 'First post body',
    });

    factory.addResource('posts', 'second-post').withAttributes({
      title: 'The Second Post',
      body: 'Second post body',
    });

    factory.addResource('content-types', 'posts').withRelated('fields', [
      factory.addResource('fields', 'title').withAttributes({
        fieldType: '@cardstack/core-types::string',
      }),
      factory.addResource('fields', 'body').withAttributes({
        fieldType: '@cardstack/core-types::string',
      }),
    ]);

    env = await createDefaultEnvironment(__dirname + '/../../../tests/ephemeral-test-app', factory.getModels());
    let cardServices = env.lookup('hub:card-services');
    await cardServices._setupPromise;

    let app = new Koa();
    app.use(env.lookup('hub:middleware-stack').middleware());
    request = defaults(supertest(app.callback()));
    ephemeralService = env.lookup(`plugin-services:${require.resolve('../service')}`);
    request.set('Accept', 'application/vnd.api+json');
  }

  async function teardown() {
    await destroyDefaultEnvironment(env);
  }

  describe('read-only', function() {
    before(setup);
    after(teardown);

    it('respects initial models', async function() {
      let response = await request.get(`/api/posts/initial`);
      expect(response).hasStatus(200);
      expect(response.body).has.deep.property('data.attributes.title', 'initial post');
    });
  });

  describe('read-write', function() {
    beforeEach(setup);
    afterEach(teardown);

    it('respect schema in initial models', async function() {
      let response = await request.post(`/api/extra-things`).send({
        data: {
          type: 'extra-things',
          attributes: {
            'extra-field': 'x',
          },
        },
      });
      expect(response).hasStatus(201);
    });

    it('can create a new record', async function() {
      let response = await request.post('/api/posts').send({
        data: {
          type: 'posts',
          attributes: {
            title: 'hello',
          },
        },
      });
      expect(response).hasStatus(201);
      expect(response.body).has.deep.property('data.meta.version');
      expect(response.body).has.deep.property('data.id');
      expect(response.body.data.id).is.ok;

      response = await request.get(`/api/posts/${response.body.data.id}`);
      expect(response).hasStatus(200);
      expect(response.body).has.deep.property('data.attributes.title', 'hello');
    });

    it('can store a card document as a single document', async function() {
      let factory = new JSONAPIFactory();
      let card = factory.getDocumentFor(
        factory
          .addResource('cards', 'local-hub::test-card')
          .withRelated('fields', [
            factory.addResource('fields', 'title').withAttributes({
              'is-metadata': true,
              'field-type': '@cardstack/core-types::string',
              'needed-when-embedded': true,
            }),
          ])
          .withRelated(
            'model',
            factory.addResource('local-hub::test-card', 'local-hub::test-card').withAttributes({
              title: 'hello',
            })
          )
      );

      let response = await request.post('/api/cards').send(card);
      expect(response).hasStatus(201);
      expect(response.body).has.deep.property('data.meta.version');
      expect(response.body).has.deep.property('data.id');
      expect(response.body.data.id).to.equal('local-hub::test-card');

      response = await request.get(`/api/cards/${response.body.data.id}`);
      expect(response).hasStatus(200);
      expect(response.body).has.deep.property('data.attributes.title', 'hello');

      let storage = await ephemeralService.findOrCreateStorage(defaultDataSourceId);
      let cardDocument = storage.lookup(card.data.id, card.data.id);
      expect(cardDocument.data).to.be.ok;
      expect(cardDocument.included.length).to.equal(1);

      let internalCardResource = storage.lookup('fields', `${card.data.id}::title`);
      expect(internalCardResource).to.be.undefined;
    });

    it('can update a record', async function() {
      let response = await request.get('/api/posts/first-post');
      expect(response).hasStatus(200);
      expect(response.body).has.deep.property('data.meta.version');
      response = await request.patch('/api/posts/first-post').send({
        data: {
          attributes: {
            body: 'Updated body',
          },
          meta: {
            version: response.body.data.meta.version,
          },
        },
      });
      expect(response).hasStatus(200);
      expect(response.body.data.attributes).deep.equals({
        body: 'Updated body',
        title: 'The First Post',
      });

      response = await request.get('/api/posts/first-post');
      expect(response).hasStatus(200);
      expect(response.body.data.attributes).deep.equals({
        body: 'Updated body',
        title: 'The First Post',
      });
    });

    it('can update a card document stored as a single document', async function() {
      let factory = new JSONAPIFactory();
      let card = factory.getDocumentFor(
        factory
          .addResource('cards', 'local-hub::test-card')
          .withRelated('fields', [
            factory.addResource('fields', 'title').withAttributes({
              'is-metadata': true,
              'field-type': '@cardstack/core-types::string',
              'needed-when-embedded': true,
            }),
          ])
          .withRelated(
            'model',
            factory.addResource('local-hub::test-card', 'local-hub::test-card').withAttributes({
              title: 'hello',
            })
          )
      );

      ({ body: card } = await request.post('/api/cards').send(card));
      let model = card.included.find(i => `${i.type}/${i.id}`);
      model.attributes.body = 'Updated Body';
      model.attributes.title = 'The First Post';
      card.data.relationships.fields.data.push({ type: 'fields', id: 'body' });
      card.included.push({
        type: 'fields',
        id: 'body',
        attributes: {
          'is-metadata': true,
          'field-type': '@cardstack/core-types::string',
          'needed-when-embedded': true,
        },
      });

      let response = await request.patch(`/api/cards/${card.data.id}`).send(card);
      expect(response).hasStatus(200);
      expect(response.body.data.attributes.body).equals('Updated Body');
      expect(response.body.data.attributes.title).equals('The First Post');

      response = await request.get(`/api/cards/${card.data.id}`);
      expect(response).hasStatus(200);
      expect(response.body.data.attributes.body).equals('Updated Body');
      expect(response.body.data.attributes.title).equals('The First Post');

      let storage = await ephemeralService.findOrCreateStorage(defaultDataSourceId);
      let cardDocument = storage.lookup(card.data.id, card.data.id);
      expect(cardDocument.data).to.be.ok;
      expect(cardDocument.included.length).to.equal(2);

      let internalCardResource = storage.lookup('fields', `${card.data.id}::title`);
      expect(internalCardResource).to.be.undefined;
      internalCardResource = storage.lookup('fields', `${card.data.id}::body`);
      expect(internalCardResource).to.be.undefined;
    });

    it('enforces meta.version consistency during update', async function() {
      let response = await request.get('/api/posts/first-post');
      expect(response).hasStatus(200);
      expect(response.body).has.deep.property('data.meta.version');
      response = await request.patch('/api/posts/first-post').send({
        data: {
          attributes: {
            body: 'Updated body',
          },
          meta: {
            version: 'not valid',
          },
        },
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

    it('can delete a card from storage', async function() {
      let factory = new JSONAPIFactory();
      let card = factory.getDocumentFor(
        factory
          .addResource('cards', 'local-hub::test-card')
          .withRelated('fields', [
            factory.addResource('fields', 'title').withAttributes({
              'is-metadata': true,
              'field-type': '@cardstack/core-types::string',
              'needed-when-embedded': true,
            }),
          ])
          .withRelated(
            'model',
            factory.addResource('local-hub::test-card', 'local-hub::test-card').withAttributes({
              title: 'hello',
            })
          )
      );

      await request.post('/api/cards').send(card);
      let response = await request.get(`/api/cards/${card.data.id}`);
      expect(response).hasStatus(200);
      expect(response.body).has.deep.property('data.meta.version');
      response = await request.delete(`/api/cards/${card.data.id}`).set('If-Match', response.body.data.meta.version);
      expect(response).hasStatus(204);

      response = await request.get(`/api/cards/${card.data.id}`);
      expect(response).hasStatus(404);

      let storage = await ephemeralService.findOrCreateStorage(defaultDataSourceId);
      let cardDocument = storage.lookup(card.data.id, card.data.id);
      expect(cardDocument).to.be.not.ok;
    });

    it('enforces meta.version consistency during delete', async function() {
      let response = await request.get('/api/posts/first-post');
      expect(response).hasStatus(200);
      expect(response.body).has.deep.property('data.meta.version');
      response = await request.delete('/api/posts/first-post').set('If-Match', 'not-valid');
      expect(response).hasStatus(409);
    });

    // keeping this test here despite the fact we dont currently use checkpoints
    // in Fixtures so that this functionality can be introduced again at a later date
    it('can create and restore an ephemeral checkpoint', async function() {
      let ephemeralService = env.lookup(`plugin-services:${require.resolve('../service')}`);
      let storage = ephemeralService.findStorage('default-data-source');

      // Grab initial records
      let first = await request.get('/api/posts/first-post');
      let second = await request.get('/api/posts/second-post');
      expect(first).hasStatus(200);
      expect(second).hasStatus(200);

      let checkpointId = '0';
      storage.makeCheckpoint(checkpointId);

      // Now do a post-checkpoint delete, patch, and post

      let response = await request
        .delete(`/api/posts/${first.body.data.id}`)
        .set('If-Match', first.body.data.meta.version);
      expect(response).hasStatus(204);

      response = await request.patch(`/api/posts/${second.body.data.id}`).send({
        data: {
          attributes: {
            body: 'updated second body',
          },
          meta: {
            version: second.body.data.meta.version,
          },
        },
      });
      expect(response).hasStatus(200);

      let third = await request.post(`/api/posts`).send({
        data: {
          type: 'posts',
          attributes: {
            title: 'third title',
          },
        },
      });
      expect(third).hasStatus(201);

      await storage.restoreCheckpoint(checkpointId);

      // and see that our delete, patch, and post are undone
      response = await request.get('/api/posts/first-post');
      expect(response).hasStatus(200);

      response = await request.get('/api/posts/second-post');
      expect(response).hasStatus(200);
      expect(response.body.data.attributes.body).to.equal('Second post body');

      response = await request.get(`/api/posts/${third.body.data.id}`);
      expect(response).hasStatus(404);
    });
  });

  describe('invalid', function() {
    it('rejects an initial data model that violates schema', async function() {
      let factory = new JSONAPIFactory();
      factory.addResource('no-such-types').withAttributes({ title: 'initial post' });
      try {
        await createDefaultEnvironment(__dirname + '/../../../tests/ephemeral-test-app', factory.getModels());
        throw new Error('should not get here');
      } catch (err) {
        expect(err.message).to.equal('"no-such-types" is not a valid type');
      }
    });

    it('rejects an initial schema model that violates bootstrap schema', async function() {
      let factory = new JSONAPIFactory();
      factory
        .addResource('content-types', 'animals')
        .withRelated('fields', [{ type: 'fields', id: 'not-a-real-field' }]);
      try {
        await createDefaultEnvironment(__dirname + '/../../../tests/ephemeral-test-app', factory.getModels());
        throw new Error('should not get here');
      } catch (err) {
        expect(err.message).to.equal('content type "animals" refers to missing field "not-a-real-field"');
      }
    });
  });
});
