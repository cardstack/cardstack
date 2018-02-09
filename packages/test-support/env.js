const temp = require('./temp-helper');
const ElasticAssert = require('@cardstack/elasticsearch/node-tests/assertions');
const JSONAPIFactory = require('./jsonapi-factory');
const crypto = require('crypto');
const { wireItUp } = require('@cardstack/hub/main');
const Session = require('@cardstack/plugin-utils/session');
const { partition } = require('lodash');

const defaultDataSourceId = 'default-data-source';

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

    // we have a default ephemeral data source during tests. But users
    // can create additional data sources and declare initial models
    // that belong within them.
    //
    // We can create (and validate) all the initialModels in the
    // ephemeral store in a single shot using the ephemeral plugin's
    // params.initialModels.
    //
    // Any other ("foreign") initial models will be written one-by-one
    // further below.
    //
    // This means you can't have a model in the ephemeral store that
    // depends on a model that is not in the ephemeral store. Or
    // rather, if you want to do that you should do it yourself
    // directly in your test setup instead of passing everything into
    // createDefaultEnvironment.
    //
    // Note that the above caveat only applies to node-tests that use
    // this module -- apps are free to put things into their ephemeral
    // store's initialModels that depend on other data sources, and
    // that works fine (as long as you've done whatever is necessary
    // to get those other data source populated).
    //
    let [
      foreignInitialModels,
      ephemeralInitialModels
    ] = partitionInitialModels(initialModels);

    factory.addResource('plugin-configs', '@cardstack/hub')
      .withRelated(
        defaultDataSourceId,
        factory.addResource('data-sources')
          .withAttributes({
            'source-type': '@cardstack/ephemeral',
            params: { initialModels: ephemeralInitialModels }
          })
      );

    factory.addResource('grants')
      .withAttributes({
        mayReadResource: true,
        mayCreateResource: true,
        mayUpdateResource: true,
        mayDeleteResource: true,
        mayReadFields: true,
        mayWriteFields: true
      }).withRelated('who', factory.addResource('groups', user.data.id));

    container = await wireItUp(projectDir, crypto.randomBytes(32), factory.getModels(), {
      disableAutomaticIndexing: true
    });

    let writers = container.lookup('hub:writers');

    for (let model of foreignInitialModels) {
      await writers.create('master', session, model.type, model);
    }

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


function partitionInitialModels(initialModels) {
  let hasNonDefaultSource = Object.create(null);
  for (let model of initialModels) {
    if (model.type === 'content-types') {
      let sourceId;
      if (model.relationships &&
          model.relationships['data-source'] &&
          (sourceId = model.relationships['data-source'].data) &&
          sourceId !== defaultDataSourceId
         ) {
        hasNonDefaultSource[model.id] = true;
      }
    }
  }
  return partition(initialModels, m => hasNonDefaultSource[m.type]);
}
