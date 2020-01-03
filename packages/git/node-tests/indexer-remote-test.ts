// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const temp = require('@cardstack/test-support/temp-helper');
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

import { todo } from '@cardstack/plugin-utils/todo-any';

const { createDefaultEnvironment, destroyDefaultEnvironment } = require('@cardstack/test-support/env'); // eslint-disable-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports

import { makeRepo } from './support';

import { join } from 'path';
import { readFileSync } from 'fs';
import { Remote, FetchOptions } from '../git';

import service from '../service';

const privateKey = readFileSync(join(__dirname, 'git-ssh-server', 'cardstack-test-key'), 'utf8');

function toResource(doc: todo) {
  return doc.data;
}

const fetchOpts = FetchOptions.privateKey(privateKey);

async function resetRemote() {
  let root = await temp.mkdir('cardstack-server-test');

  let tempRepo = await makeRepo(root, {
    'contents/events/event-1.json': JSON.stringify({
      attributes: {
        title: 'This is a test event',
        'published-date': '2018-09-25',
      },
    }),
    'contents/events/event-2.json': JSON.stringify({
      attributes: {
        title: 'This is another test event',
        'published-date': '2018-10-25',
      },
    }),
  });

  let remote = await Remote.create(tempRepo.repo, 'origin', 'ssh://root@localhost:9022/root/data-test');
  await remote.push(['+refs/heads/master:refs/heads/master'], fetchOpts);

  return tempRepo;
}

describe('git/indexer remote config', function() {
  this.timeout(10000);

  beforeEach(async function() {
    await resetRemote();
  });

  afterEach(async function() {
    await temp.cleanup();
    service.clearCache();
  });

  it('throws an error when remote and repo are defined', function() {
    let factory = new JSONAPIFactory();
    let dataSource = factory.addResource('data-sources').withAttributes({
      'source-type': '@cardstack/git',
      params: {
        repo: '/user/repo',
        remote: {
          url: 'ssh://root@localhost:9022/root/data-test',
          privateKey,
        },
      },
    });
    factory.addResource('plugin-configs', '@cardstack/hub').withRelated('default-data-source', dataSource);

    return expect(createDefaultEnvironment(join(__dirname, '..'), factory.getModels())).to.be.rejectedWith(
      /You cannot define the params 'remote' and 'repo' at the same time for this data source/
    );
  });

  it('does not throw an error when remote is configured on its own', async function() {
    let factory = new JSONAPIFactory();

    let dataSource = factory.addResource('data-sources').withAttributes({
      'source-type': '@cardstack/git',
      params: {
        remote: {
          url: 'ssh://root@localhost:9022/root/data-test',
          privateKey,
        },
      },
    });
    factory.addResource('plugin-configs', '@cardstack/hub').withRelated('default-data-source', dataSource);

    let env = await createDefaultEnvironment(join(__dirname, '..'), factory.getModels());
    await destroyDefaultEnvironment(env);
  });

  it('does not throw an error when repo is configured on its own', async function() {
    let factory = new JSONAPIFactory();
    let repo = await temp.mkdir('cardstack-server-test-remote');

    let dataSource = factory.addResource('data-sources').withAttributes({
      'source-type': '@cardstack/git',
      params: {
        repo,
      },
    });

    factory.addResource('plugin-configs', '@cardstack/hub').withRelated('default-data-source', dataSource);

    let env = await createDefaultEnvironment(join(__dirname, '..'), factory.getModels());
    await destroyDefaultEnvironment(env);
  });
});

describe.only('git/indexer cloning', function() {
  let env: todo, indexer: todo, searcher: todo, dataSource: todo, start: Function, client: todo, head: string;

  this.timeout(10000);

  beforeEach(async function() {
    let tempRepo = await resetRemote();

    head = tempRepo.head;

    let factory = new JSONAPIFactory();

    factory.addResource('content-types', 'events').withRelated('fields', [
      factory.addResource('fields', 'title').withAttributes({
        fieldType: '@cardstack/core-types::string',
      }),
      factory.addResource('fields', 'published-date').withAttributes({
        fieldType: '@cardstack/core-types::string',
      }),
    ]);

    let cacheDir = await temp.mkdir('indexer-cloning-test');

    dataSource = factory.addResource('data-sources').withAttributes({
      'source-type': '@cardstack/git',
      params: {
        remote: {
          url: 'ssh://root@localhost:9022/root/data-test',
          privateKey,
          cacheDir,
        },
      },
    });

    start = async function() {
      env = await createDefaultEnvironment(join(__dirname, '..'), factory.getModels());
      indexer = env.lookup('hub:indexers');
      searcher = env.lookup('hub:searchers');
      client = env.lookup(`plugin-client:${require.resolve('@cardstack/pgsearch/client')}`);
    };
  });

  afterEach(async function() {
    await temp.cleanup();
    await destroyDefaultEnvironment(env);
    service.clearCache();
  });

  it('clones the remote repo', async function() {
    await start();
    let indexerState = await client.loadMeta({ branch: 'master', id: dataSource.id });
    expect(indexerState.commit).to.equal(head);
  });

  it('indexes existing data in the remote after it is cloned', async function() {
    await start();
    await indexer.update();

    let contents = await searcher.get(env.session, 'local-hub', 'events', 'event-1');
    let jsonapi = toResource(contents);
    expect(jsonapi).has.deep.property('attributes.title', 'This is a test event');
  });
});
