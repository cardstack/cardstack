const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('@cardstack/test-support/env');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
const { join } = require('path');
const { readFileSync } = require('fs');
const { promisify } = require('util');
const temp = require('temp').track();

const mkdir = promisify(temp.mkdir);

const privateKey = readFileSync(join(__dirname, 'git-ssh-server', 'cardstack-test-key'), 'utf8');

describe.only('local git cache service', function() {
  let env, tempRepoPath;

  beforeEach(async function() {
    let factory = new JSONAPIFactory();

    tempRepoPath = await mkdir('cardstack-temp-test-repos');

    let dataSource = factory.addResource('data-sources')
        .withAttributes({
          'source-type': '@cardstack/git',
          params: {
            remote: {
              url: 'ssh://root@localhost:9022/root/data-test',
              privateKey,
              cacheDir: tempRepoPath,
            }
          }
        });

    factory.addResource('plugin-configs', '@cardstack/hub')
      .withRelated(
        'default-data-source',
        dataSource
      );

    env = await createDefaultEnvironment(`${__dirname}/..`, factory.getModels());
  });

  afterEach(async function() {
    await temp.cleanup();
    await destroyDefaultEnvironment(env);
  });

  it('creates a local clone of the repo with a naming convention', async function() {

  });

  it('consideres localhost and 127.0.0.1 different for the purposes of a local cache');

  // TODO: maybe put this in the writer/indexer tests? or maybe it's a different describe?
  it.skip('only creates one local repo if the remote is the same for the writer and indexer', async function() {

    //assert that the create function in the service is called twice
    //assert that there is only one repo
  });
});
