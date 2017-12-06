const temp = require('./temp-helper');
const ElasticAssert = require('@cardstack/elasticsearch/node-tests/assertions');
const JSONAPIFactory = require('./jsonapi-factory');
const crypto = require('crypto');
const { wireItUp } = require('@cardstack/hub/main');
const Session = require('@cardstack/plugin-utils/session');

exports.createDefaultEnvironment = async function(projectDir, initialModels = []) {
  let container;
  try {
    let factory = new JSONAPIFactory();

    let user = factory.addResource('users', 'the-default-test-user').withAttributes({
      fullName: 'Default Test Environment',
      email: 'test@example.com'
    }).asDocument();

    let session = new Session(
      { id: 'the-default-test-user', type: 'users'},
      null,
      user
    );

    factory.addResource('plugin-configs', '@cardstack/hub')
      .withRelated(
        'default-data-source',
        factory.addResource('data-sources')
          .withAttributes({
            'source-type': '@cardstack/ephemeral',
            params: { initialModels }
          })
      );

    factory.addResource('grants')
      .withAttributes({
        mayCreateResource: true,
        mayUpdateResource: true,
        mayDeleteResource: true,
        mayWriteField: true
      }).withRelated('who', factory.addResource('groups', user.data.id));

    container = await wireItUp(projectDir, crypto.randomBytes(32), factory.getModels(), {
      allowDevDependencies: true,
      disableAutomaticIndexing: true
    });

    await container.lookup('hub:indexers').update({ realTime: true });

    Object.assign(container, {
      session,
      user,
      async setUserId(id) {
        let plugins = await this.lookup('hub:plugins').active();
        let m = plugins.lookupFeatureAndAssert('middleware', '@cardstack/test-support-authenticator');
        m.userId = id;
      }
    });
    return container;
  } catch (err) {
    // don't leave a half-constructed environment lying around if we
    // failed. Cleanup whatever parts were already created.
    if (container) {
      container.teardown();
    }
    destroyIndices();
    temp.cleanup();
    throw err;
  }
};

  exports.destroyDefaultEnvironment = async function(env) {
    if (env) {
      await env.teardown();
      await destroyIndices();
      await temp.cleanup();
    }
  };

  async function destroyIndices() {
    let ea = new ElasticAssert();
    await ea.deleteContentIndices();
  }
