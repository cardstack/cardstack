const JSONAPIFactory = require('../../../tests/stub-project/node_modules/@cardstack/test-support/jsonapi-factory');
const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('../../../tests/stub-project/node_modules/@cardstack/test-support/env');

describe('hub/indexers', function() {
  let env;

  async function setup () {
    env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-project`);
  }

  async function teardown() {
    await destroyDefaultEnvironment(env);
  }

  describe('read-only', function() {
    before(setup);
    after(teardown);


    it("indexes seed models", async function() {
      // this seed model comes from createDefaultEnvironment
      let response = await env.lookup('hub:searchers').search(env.session, 'master', { filter: { type: 'plugin-configs' }});
      expect(response.data.map(m => m.id)).includes('@cardstack/hub');
    });

    it("indexes bootstrap models", async function() {
      let response = await env.lookup('hub:searchers').search(env.session, 'master', {
        filter: { type: 'content-types' },
        page: { size: 100 }
      });
      expect(response.data.map(m => m.id)).includes('content-types');
    });

    it("indexes plugins", async function() {
      let doc = await env.lookup('hub:searchers').get(env.session, 'master', 'plugins', 'sample-plugin-one');
      expect(doc).is.ok;
    });

    it("includes features within plugins", async function() {
      let doc = await env.lookup('hub:searchers').get(env.session, 'master', 'plugins', 'sample-plugin-one');
      expect(doc).has.property('included');
      expect(doc.included.map(r => r.id)).deep.equals(['sample-plugin-one::x']);
    });

    it("indexes plugin features", async function() {
      let doc = await env.lookup('hub:searchers').get(env.session, 'master', 'field-types', 'sample-plugin-one::x');
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
      let doc = await env.lookup('hub:searchers').get(env.session, 'master', 'plugins', 'sample-plugin-one');
      expect(doc).has.deep.property('data.attributes.enabled', true);
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
      doc = await env.lookup('hub:searchers').get(env.session, 'master', 'plugins', 'sample-plugin-one');
      expect(doc).has.deep.property('data.attributes.enabled', false);
    });
  });

  describe("nested data sources", function() {
    afterEach(teardown);

    // TODO: this test passes, but it's not succesfully testing the
    // semantics we want to test, because we don't actually have
    // full relationship validation yet.
    it('can traverse across inconsistent intermediate schemas on the way to building a complete consistent schema', async function() {

      // we have a comment sitting in the inner data source
      let inner = new JSONAPIFactory();
      inner.addResource('comments', '1');

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
                  sourceType: '@cardstack/ephemeral',
                  params: {
                    initialModels: inner.getModels()
                  }
                })
              )
          ])
        ]);

      seeds.addResource('posts', '1').withRelated('comments', [
        { type: 'comments', id: '1' }
      ]);

      env = await createDefaultEnvironment(__dirname + '/../../../tests/ephemeral-test-app', seeds.getModels());

      let response = await env.lookup('hub:searchers').get(env.session, 'master', 'posts', '1');
      expect(response).is.ok;
      response = await env.lookup('hub:searchers').get(env.session, 'master', 'comments', '1');
      expect(response).is.ok;

    });
  });

  describe('events', function() {
    beforeEach(setup);
    afterEach(teardown);

    it("triggers events when indexing", async function() {
      let indexers = await env.lookup('hub:indexers');

      let addCount = 0;
      let updateCompleteCount = 0;

      indexers.on('update_complete', hints => {
        updateCompleteCount++;
        expect(hints).to.deep.equal({ foo: 'bar' });
      });

      indexers.on('add', model => {
        addCount++;

        switch (model.id) {
          case 'checkpoint' :
            expect(model).to.deep.equal({
              "type": "fields",
              "id": "checkpoint",
              "doc": {
                "type": "fields",
                "id": "checkpoint",
                "attributes": {
                  "field-type": "@cardstack/core-types::belongs-to"
                },
                "relationships": {
                  "related-types": {
                    "data": [
                      {
                        "type": "content-types",
                        "id": "ephemeral-checkpoints"
                      }
                    ]
                  }
                }
              }
            });
            break;
          case 'ephemeral-checkpoints' :
            delete model.doc.relationships['data-source'].data.id;
            expect(model).to.deep.equal({
              "type": "content-types",
              "id": "ephemeral-checkpoints",
              "doc": {
                "type": "content-types",
                "id": "ephemeral-checkpoints",
                "attributes": {
                  "is-built-in": true
                },
                "relationships": {
                  "data-source": {
                    "data": {
                      "type": "data-sources",
                    }
                  }
                }
              }
            });
            break;
					case 'ephemeral-restores' :
            delete model.doc.relationships['data-source'].data.id;
						expect(model).to.deep.equal({
							"type": "content-types",
							"id": "ephemeral-restores",
							"doc": {
								"type": "content-types",
								"id": "ephemeral-restores",
								"attributes": {
									"is-built-in": true
								},
								"relationships": {
									"data-source": {
										"data": {
											"type": "data-sources",
										}
									},
									"fields": {
										"data": [
											{
												"type": "fields",
												"id": "checkpoint"
											}
										]
									}
								}
							}
						});
            break;
        }
      });

      await indexers.update({ realTime: true, hints: { foo: 'bar' } });
      expect(addCount).to.equal(3, 'the correct number of add events were emitted');
      expect(updateCompleteCount).to.equal(1, 'the correct number of update_complete events were emitted');
    });
  });

});
