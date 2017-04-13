const Searcher = require('@cardstack/elasticsearch/searcher');
const SchemaCache = require('@cardstack/hub/schema-cache');
const temp = require('@cardstack/plugin-utils/node-tests/temp-helper');
const { makeRepo } = require('@cardstack/git/node-tests/support');
const Indexers = require('@cardstack/hub/indexers');
const Writers = require('@cardstack/hub/writers');
const ElasticAssert = require('@cardstack/elasticsearch/node-tests/assertions');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
const { Registry, Container } = require('@cardstack/di');

exports.createDefaultEnvironment = async function(initialModels = []) {
  let repoPath = await temp.mkdir('cardstack-server-test');

  // TODO: The git writer should make its own local repo when it
  // starts up the first time.
  let { head, repo } = await makeRepo(repoPath);

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
          'source-type': '@cardstack/git',
          params: { repo: repoPath }
        })
    );

  factory.addResource('plugin-configs')
    .withAttributes({ module: '@cardstack/git' });

  factory.addResource('grants')
    .withAttributes({
      mayCreateResource: true,
      mayUpdateResource: true,
      mayDeleteResource: true,
      mayWriteField: true
    }).withRelated('who', factory.addResource('groups', user.id));

  let schemaCache = new SchemaCache(factory.getModels());

  let registry = new Registry();
  registry.register('schema-cache:main', schemaCache, { instantiate: false });
  registry.register('writers:main', Writers);
  registry.register('searcher:main', Searcher);

  let container = new Container(registry);


  let writers = container.lookup('writers:main');

  // TODO: Indexers should just take schemaCache and figure out its
  // own indexers list. Need to figure out how this plays with the
  // branches. In some cases, a "branch" exists because of
  // configuration on a data-source (like using different postgres
  // databases to represent "master" vs "production"). But in the git
  // case, the branches are discovered by the indexer and we have a
  // circular dependency to break.
  //
  // Solution: add some server-level config (probably in the
  // plugin-config for @cardstack/hub) for the branch name that
  // always controls which indexers to run. This would also work for
  // branch-level grants: to create a branch, you must have a grant on
  // this specially-privileged branch.
  let indexer = new Indexers(schemaCache);

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
    let response = await writers.create('master', user.data, model.type, model);
    head = response.meta.version;
  }

  await indexer.update({ realTime: true });



  Object.assign(container, {
    indexer,
    user: user.data,
    schemaCache,
    head,
    repo,
    repoPath
  });
  return container;
};

exports.destroyDefaultEnvironment = async function(/* env */) {
  await destroyIndices();
  await temp.cleanup();
};

exports.TestAuthenticator = class {
  constructor(initialUser) {
    this.user = initialUser;
  }
  middleware() {
    let self = this;
    return async (ctxt, next) => {
      ctxt.state.cardstackSession = {
        userId: self.user ? self.user.id : null,
        async loadUser() {
          return self.user;
        }
      };
      await next();
    };
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
