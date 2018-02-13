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
      await env.lookup('hub:indexers').update({ realTime: true });
      doc = await env.lookup('hub:searchers').get(env.session, 'master', 'plugins', 'sample-plugin-one');
      expect(doc).has.deep.property('data.attributes.enabled', false);
    });
  });
});
