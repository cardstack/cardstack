const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('@cardstack/test-support/env');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
const { join } = require('path');
const { readFileSync, readdirSync } = require('fs');
const { promisify } = require('util');
const sinon = require('sinon');
const temp = require('temp').track();
const service = require('../service');

const mkdir = promisify(temp.mkdir);

const privateKey = readFileSync(join(__dirname, 'git-ssh-server', 'cardstack-test-key'), 'utf8');

describe('local git cache service', function() {
  this.timeout(10000);

  beforeEach(() => {
    service.clearCache();
  });

  afterEach(() => {
    service.clearCache();
  });

  it('creates a local clone of the repo with a naming convention', async function() {
    let tempRepoPath = await mkdir('test-1');

    let factory = new JSONAPIFactory();

    let dataSource1 = factory.addResource('data-sources')
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
        'default-data-source-test-1',
        dataSource1
      );

    let env = await createDefaultEnvironment(`${__dirname}/..`, factory.getModels());

    expect(readdirSync(tempRepoPath)).to.have.length(1);

    await temp.cleanup();
    await destroyDefaultEnvironment(env);
  });

  it('consideres localhost and 127.0.0.1 different for the purposes of a local cache', async function() {
    let tempRepoPath = await mkdir('test-2');

    let factory = new JSONAPIFactory();

    let dataSource1 = factory.addResource('data-sources')
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

    let dataSource2 = factory.addResource('data-sources')
        .withAttributes({
          'source-type': '@cardstack/git',
          params: {
            remote: {
              url: 'ssh://root@127.0.0.1:9022/root/data-test',
              privateKey,
              cacheDir: tempRepoPath,
            }
          }
        });

    factory.addResource('plugin-configs', '@cardstack/hub')
      .withRelated(
        'default-data-source',
        dataSource1
      );

    factory.addResource('plugin-configs', '@cardstack/hub')
      .withRelated(
        'second-data-source',
        dataSource2
      );

    let env = await createDefaultEnvironment(`${__dirname}/..`, factory.getModels());

    expect(readdirSync(tempRepoPath)).to.have.length(2);

    await temp.cleanup();
    await destroyDefaultEnvironment(env);
  });

  it('only creates one local repo if the remote is the same for the writer and indexer', async function() {
    sinon.spy(service, 'getRepo');
    sinon.spy(service, '_makeRepo');

    let tempRepoPath = await mkdir('test-3');

    let factory = new JSONAPIFactory();

    let dataSource1 = factory.addResource('data-sources')
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
        'default-data-source-test-1',
        dataSource1
      );

    let env = await createDefaultEnvironment(`${__dirname}/..`, factory.getModels());

    sinon.assert.calledTwice(service.getRepo);
    sinon.assert.calledOnce(service._makeRepo);

    await temp.cleanup();
    await destroyDefaultEnvironment(env);
    service.getRepo.restore();
    service._makeRepo.restore();
  });
});
