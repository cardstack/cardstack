const JSONAPIFactory = require('../../../tests/stub-project/node_modules/@cardstack/test-support/jsonapi-factory');
const Session = require('@cardstack/plugin-utils/session');
const {
  createDefaultEnvironment,
  destroyDefaultEnvironment,
  defaultDataSourceId
} = require('../../../tests/stub-project/node_modules/@cardstack/test-support/env');
const { createReadStream, readdirSync } = require('fs');
const path = require('path');

describe('hub/indexers', function() {
  let env;

  async function setup (models = []) {
    env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-project`, models);
  }

  async function teardown() {
    await destroyDefaultEnvironment(env);
  }

  describe('read-only', function() {
    before(setup);
    after(teardown);


    it("indexes seed models", async function() {
      // this seed model comes from createDefaultEnvironment
      let response = await env.lookup('hub:searchers').search(env.session, { filter: { type: 'plugin-configs' }});
      expect(response.data.map(m => m.id)).includes('@cardstack/hub');
    });

    it("indexes bootstrap models", async function() {
      let response = await env.lookup('hub:searchers').search(env.session, {
        filter: { type: 'content-types' },
        page: { size: 100 }
      });
      expect(response.data.map(m => m.id)).includes('content-types');
    });

    it("indexes plugins", async function() {
      let doc = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'plugins', 'sample-plugin-one');
      expect(doc).is.ok;
    });

    it("includes the data source on each resource", async function() {
      let doc = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'plugins', 'sample-plugin-one');
      expect(doc).has.deep.property('data.meta.source', 'plugins');
      doc = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'content-types', 'fields');
      expect(doc).has.deep.property('data.meta.source', 'static-models');
    });

    it("includes features within plugins", async function() {
      let doc = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'plugins', 'sample-plugin-one');
      expect(doc).has.property('included');
      expect(doc.included.map(r => r.id)).deep.equals(['sample-plugin-one::x']);
    });

    it("indexes plugin features", async function() {
      let doc = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'field-types', 'sample-plugin-one::x');
      expect(doc).is.ok;
    });

  });

  describe('read-write', function() {
    beforeEach(setup);
    afterEach(teardown);

    it("indexes plugin-config changes", async function() {
      // this test is deliberately writing directly to the ephemeral
      // backend instead of going through hub:writers. That ensures
      // we aren't relying on side-effects from the writers.
      let doc = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'plugins', 'sample-plugin-one');
      expect(doc).has.deep.property('data.attributes.plugin-enabled', true);
      let config = {
        id: 'sample-plugin-one',
        type: 'plugin-configs',
        attributes: {
          enabled: false
        }
      };
      let activeSources = await env.lookup('hub:data-sources').active();
      let source = [...activeSources.values()].find(s => s.sourceType === '@cardstack/ephemeral');
      let storage = await source.writer.storage;
      storage.store(config.type, config.id, config, false, null);
      await env.lookup('hub:indexers').update({ forceRefresh: true });
      doc = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'plugins', 'sample-plugin-one');
      expect(doc).has.deep.property('data.attributes.plugin-enabled', false);
    });
  });


  describe('binary data', function() {
    before(async function() {
      let factory = new JSONAPIFactory();

      factory.addResource('content-types', 'cardstack-files')
        .withRelated('fields', [
          factory.addResource('fields', 'created-at').withAttributes({fieldType: '@cardstack/core-types::date'}),
          factory.addResource('fields', 'content-type').withAttributes({fieldType: '@cardstack/core-types::string'}),
          factory.addResource('fields', 'sha-sum').withAttributes({fieldType: '@cardstack/core-types::string'}),
          factory.addResource('fields', 'file-name').withAttributes({fieldType: '@cardstack/core-types::string'}),
          factory.addResource('fields', 'size').withAttributes({fieldType: '@cardstack/core-types::integer'})
        ]);

      let models = factory.getModels();

      await setup(models);
    });

    after(teardown);

    it("indexes ephemeral binary data", async function() {
      let writers = env.lookup('hub:writers');

      await Promise.all(readdirSync(path.join(__dirname, './images')).map(async filename => {
        let readStream = createReadStream(path.join(__dirname, 'images', filename));
        readStream.type = 'cardstack-files';
        readStream.id = filename.replace(/\..+/, '');
        await writers.createBinary(Session.INTERNAL_PRIVILEGED, 'cardstack-files', readStream);
      }));

      let response = await env.lookup('hub:searchers').search(env.session, { filter: { type: 'cardstack-files' }});
      expect(response.data.map(m => m.type)).includes('cardstack-files');
      expect(response.data).has.length(2);
      expect(response.data[0]).has.property('id').equal('cardstack-logo');
      expect(response.data[0].attributes).has.property('file-name').includes('cardstack-logo.png');
      expect(response.data[1]).has.property('id').equal('snalc');
      expect(response.data[1].attributes).has.property('file-name').includes('snalc.gif');
    });

  });

  describe("nested data sources", function() {
    afterEach(teardown);

    // TODO: this test passes, but it's not succesfully testing the
    // semantics we want to test, because we don't actually have
    // full relationship validation yet.
    it('can traverse across inconsistent intermediate schemas on the way to building a complete consistent schema', async function() {

      let seeds = new JSONAPIFactory();
      seeds.addResource('content-types', 'posts')
        .withRelated('fields', [
          seeds.addResource('fields', 'comments').withAttributes({
            fieldType: '@cardstack/core-types::has-many'
          }).withRelated('related-types', [
            // the comments content type is stored inside "inner"
            // (unlike the rest of our models, which are stored in the
            // default data source provided by
            // createDefaultEnvironment)
            seeds.addResource('content-types', 'comments')
              .withRelated(
                'data-source',
                seeds.addResource('data-sources', 'inner').withAttributes({
                  sourceType: '@cardstack/ephemeral'
                })
              )
          ])
        ]);

      seeds.addResource('posts', '1').withRelated('comments', [
        seeds.addResource('comments', '1')
      ]);

      env = await createDefaultEnvironment(__dirname + '/../../../tests/ephemeral-test-app', seeds.getModels());

      let response = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'posts', '1');
      expect(response).is.ok;
      response = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'comments', '1');
      expect(response).is.ok;

    });
  });

  describe('events', function() {
    afterEach(teardown);

    it("triggers events when indexing", async function() {
      let seeds = new JSONAPIFactory();

      seeds.addResource('content-types', 'dogs')
        .withRelated('fields', [
          seeds.addResource('fields', 'name')
          .withAttributes({ fieldType: '@cardstack/core-types::string' }),
        ]);

      env = await createDefaultEnvironment(__dirname + '/../../../tests/ephemeral-test-app', seeds.getModels());
      let indexers = await env.lookup('hub:indexers');

      let addCount = 0;
      let updateCompleteCount = 0;

      indexers.on('update_complete', hints => {
        updateCompleteCount++;
        expect(hints).to.deep.equal({ type: 'dogs' });
      });

      indexers.on('add', model => {
        addCount++;

        expect(model.id).to.be.ok;
        expect(model.doc.data.id).to.be.ok;
        expect(model.doc.data.meta.version).to.be.ok;
        delete model.id;
        delete model.doc.data.id;
        delete model.doc.data.meta.version;
        expect(model).to.deep.equal({
          type: "dogs",
          doc: {
            data: {
              type: "dogs",
              attributes: {
                name: "Van Gogh"
              },
              meta: { }
            }
          }
        });
      });

      await env.lookup('hub:writers').create(Session.INTERNAL_PRIVILEGED, 'dogs', {
        data: {
          type: 'dogs',
          attributes: {
            name: 'Van Gogh'
          }
        }
      });
      await env.lookup('hub:indexers').update({ forceRefresh: true, hints: { type: 'dogs' } });

      expect(addCount).to.equal(1, 'the correct number of add events were emitted');
      expect(updateCompleteCount).to.equal(1, 'the correct number of update_complete events were emitted');
    });
  });

  describe('invalid data', function() {
    async function saveEphemeral(fn) {
      let factory = new JSONAPIFactory();
      fn(factory);
      // Go through the back door to insert some invalid data into
      // ephemeral storage (if we try to do a write, it would fail
      // validation before we store it in the data source -- in this
      // test we want to see what happens when a data source already
      // contains bad data)
      let sources = await env.lookup('hub:data-sources').active();
      let source = sources.get(defaultDataSourceId);
      let storage = source.writer.storage;
      for (let doc of factory.getModels()) {
        storage.store(doc.type, doc.id, doc, false);
      }
      await env.lookup('hub:indexers').update({ forceRefresh: true });
    }

    before(async function() {
      let factory = new JSONAPIFactory();
      factory.addResource('content-types', 'samples')
        .withRelated('fields', [
          factory.addResource('fields', 'real-field')
            .withAttributes({
              fieldType: '@cardstack/core-types::string'
            }),
          factory.addResource('fields', 'real-relationship')
            .withAttributes({
              fieldType: '@cardstack/core-types::belongs-to'
            })
        ]);
      env = await createDefaultEnvironment(__dirname + '/../../../tests/ephemeral-test-app', factory.getModels());
      await saveEphemeral(f => {
        f.addResource('samples', 'has-bogus-attribute').withAttributes({
          realField: 'yes',
          fakeField: 'no'
        });
        f.addResource('samples', 'has-bogus-relationship')
          .withRelated('realRelationship', {
            type: 'content-types', id: 'samples'
          })
          .withRelated('fakeRelationship', {
            type: 'content-types', id: 'samples'
          });
        f.addResource('not-a-thing', '1').withAttributes({
          realField: 'yes'
        });
      });

    });

    after(teardown);


    it("does not allow unknown attributes into search index", async function() {
      let doc = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'samples', 'has-bogus-attribute');
      expect(doc).has.deep.property('data.attributes');
      expect(doc.data.attributes).has.property('real-field');
      expect(doc.data.attributes).not.has.property('fake-field');
    });

    it("does not allow unknown relationships into search index", async function() {
      let doc = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'samples', 'has-bogus-relationship');
      expect(doc).has.deep.property('data.relationships');
      expect(doc.data.relationships).has.property('real-relationship');
      expect(doc.data.relationships).not.has.property('fake-relationship');
    });

    it("does not allow unknown document types into search index", async function() {
      let response = await env.lookup('hub:searchers').search(env.session, { filter: { type: 'not-a-thing' }});
      expect(response.data).has.length(0);
    });


  });

});
