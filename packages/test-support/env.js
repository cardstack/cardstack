const temp = require('./temp-helper');
const ElasticAssert = require('@cardstack/elasticsearch/node-tests/assertions');
const JSONAPIFactory = require('./jsonapi-factory');
const crypto = require('crypto');
const { wireItUp } = require('@cardstack/hub/main');

exports.createDefaultEnvironment = async function(projectDir, initialModels = []) {
  let factory = new JSONAPIFactory();

  let user = factory.addResource('users', 'the-default-test-user').withAttributes({
    fullName: 'Default Test Environment',
    email: 'test@example.com'
  });

  factory.addResource('plugin-configs')
    .withAttributes({
      module: '@cardstack/hub',
    }).withRelated(
      'default-data-source',
      factory.addResource('data-sources')
        .withAttributes({
          'source-type': '@cardstack/ephemeral'
        })
    );

  factory.addResource('plugin-configs')
    .withAttributes({ module: '@cardstack/ephemeral' });

  factory.addResource('grants')
    .withAttributes({
      mayCreateResource: true,
      mayUpdateResource: true,
      mayDeleteResource: true,
      mayWriteField: true
    }).withRelated('who', factory.addResource('groups', user.id));

  let container = await wireItUp(projectDir, crypto.randomBytes(32), factory.getModels(), true);

  let writers = container.lookup('hub:writers');

  for (let model of inDependencyOrder(initialModels)) {
    // TODO: this one-by-one creation is still slower than is nice for
    // tests -- each time we write a schema model it invalidates the
    // schema cache, which needs to get rebuilt before we can write
    // the next one. Which also requires us to use inDependencyOrder,
    // which is kinda lame.
    //
    // On the other hand, this is a high-quality test of our ability
    // to build up the entire state in the same way an end user would
    // via JSONAPI requests. If we optimize this away, we should also
    // add some tests like that that are similarly comprehensive.
    await writers.create('master', user.data, model.type, model);
  }

  await container.lookup('hub:indexers').update({ realTime: true });

  Object.assign(container, {
    user: user.data,
    async setUserId(id) {
      let schema = await this.lookup('hub:schema-cache').schemaForControllingBranch();
      let m = schema.plugins.lookupFeatureAndAssert('middleware', '@cardstack/test-support/authenticator');
      m.userId = id;
    }
  });
  return container;
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

function inDependencyOrder(models) {
  let priority = ['default-values', 'plugin-configs', 'constraints', 'fields', 'content-types'];
  return priority.map(type => models.filter(m => m.type === type)).reduce((a,b) => a.concat(b), []).concat(models.filter(m => !priority.includes(m.type)));
}
