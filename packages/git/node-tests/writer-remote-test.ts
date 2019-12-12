import { Repository, FetchOptions, Remote } from '../git';

const { createDefaultEnvironment, destroyDefaultEnvironment } = require('@cardstack/test-support/env'); // eslint-disable-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports

// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

import { todo } from '@cardstack/plugin-utils/todo-any';

import { join } from 'path';
import { readFileSync } from 'fs';
import { promisify } from 'util';

// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const temp = require('@cardstack/test-support/temp-helper');

import { inRepo, makeRepo } from './support';
import Change from '../change';
import service from '../service';

const mkdir = promisify(temp.mkdir);

const privateKey = readFileSync(join(__dirname, 'git-ssh-server', 'cardstack-test-key'), 'utf8');
import { fake, replace } from 'sinon';

const fetchOpts = FetchOptions.privateKey(privateKey);

async function resetRemote() {
  let root = await temp.mkdir('cardstack-server-test');

  let tempRepo = await makeRepo(root, {
    'contents/events/event-1.json': JSON.stringify(
      {
        attributes: {
          title: 'This is a test event',
          'published-date': '2018-09-25',
        },
      },
      null,
      2
    ),
    'contents/events/event-2.json': JSON.stringify(
      {
        attributes: {
          title: 'This is another test event',
          'published-date': '2018-10-25',
        },
      },
      null,
      2
    ),
  });

  let remote = await Remote.create(tempRepo.repo, 'origin', 'ssh://root@localhost:9022/root/data-test');
  await remote.push(['+refs/heads/master:refs/heads/master'], fetchOpts);
  return tempRepo;
}

describe('git/writer with remote', function() {
  let env: todo,
    writers: todo,
    repo: Repository,
    tempRepoPath,
    tempRemoteRepoPath: string,
    head: string,
    remoteRepo: Repository;

  this.timeout(10000);

  beforeEach(async function() {
    let tempRepo = await resetRemote();

    head = tempRepo.head;
    remoteRepo = tempRepo.repo;

    let factory = new JSONAPIFactory();

    tempRepoPath = await mkdir('cardstack-temp-test-repo');
    tempRemoteRepoPath = await mkdir('cardstack-temp-test-remote-repo');

    repo = await Repository.clone('ssh://root@localhost:9022/root/data-test', tempRemoteRepoPath, {
      fetchOpts,
    });

    let dataSource = factory.addResource('data-sources').withAttributes({
      'source-type': '@cardstack/git',
      params: {
        remote: {
          url: 'ssh://root@localhost:9022/root/data-test',
          privateKey,
          cacheDir: tempRepoPath,
        },
      },
    });

    factory
      .addResource('content-types', 'events')
      .withRelated('fields', [
        factory.addResource('fields', 'title').withAttributes({ fieldType: '@cardstack/core-types::string' }),
        factory.addResource('fields', 'published-date').withAttributes({ fieldType: '@cardstack/core-types::string' }),
      ])
      .withRelated('data-source', dataSource);

    env = await createDefaultEnvironment(`${__dirname}/..`, factory.getModels());
    writers = env.lookup('hub:writers');
  });

  afterEach(async function() {
    await temp.cleanup();
    await destroyDefaultEnvironment(env);
    service.clearCache();
  });

  describe('create', function() {
    it('saves attributes', async function() {
      let { data: record } = await writers.create(env.session, 'events', {
        data: {
          type: 'events',
          attributes: {
            title: 'Second Event',
            'published-date': '2018-09-01',
          },
        },
      });
      await repo.fetch('origin', fetchOpts);
      let saved = await inRepo(tempRemoteRepoPath).getJSONContents(
        'origin/master',
        `contents/events/${record.id}.json`
      );
      expect(saved).to.deep.equal({
        attributes: {
          title: 'Second Event',
          'published-date': '2018-09-01',
        },
      });
    });
  });

  describe('update', function() {
    it('returns updated document', async function() {
      let { data: record } = await writers.update(env.session, 'events', 'event-1', {
        data: {
          id: 'event-1',
          type: 'events',
          attributes: {
            title: 'Updated title',
          },
          meta: {
            version: head,
          },
        },
      });
      expect(record).has.deep.property('attributes.title', 'Updated title');
      expect(record)
        .has.deep.property('meta.version')
        .not.equal(head);

      await repo.fetch('origin', fetchOpts);
      let updated = await inRepo(tempRemoteRepoPath).getJSONContents('origin/master', `contents/events/event-1.json`);

      expect(updated).to.deep.equal({
        attributes: {
          title: 'Updated title',
          'published-date': '2018-09-25',
        },
      });
    });

    it('successfully merges updates when repo is out of sync', async function() {
      this.timeout(20000);

      let change = await Change.create(remoteRepo, head, 'master', fetchOpts);

      let file = await change.get('contents/events/event-2.json', { allowUpdate: true });

      file.setContent(
        JSON.stringify({
          attributes: {
            title: 'This is a test event',
            'published-date': '2019-09-25',
          },
        })
      );

      await change.finalize({
        authorName: 'John Milton',
        authorEmail: 'john@paradiselost.com',
        message: 'I probably shouldnt update this out of sync',
      });

      await remoteRepo.getRemote('origin');

      let { data: record } = await writers.update(env.session, 'events', 'event-1', {
        data: {
          id: 'event-1',
          type: 'events',
          attributes: {
            title: 'Updated title',
          },
          meta: {
            version: head,
          },
        },
      });
      expect(record).has.deep.property('attributes.title', 'Updated title');
      expect(record)
        .has.deep.property('meta.version')
        .not.equal(head);

      await repo.fetch('origin', fetchOpts);
      let updated = await inRepo(tempRemoteRepoPath).getJSONContents('origin/master', `contents/events/event-1.json`);

      expect(updated).to.deep.equal({
        attributes: {
          title: 'Updated title',
          'published-date': '2018-09-25',
        },
      });
    });

    it('successfully merges updates when same file is out of sync', async function() {
      this.timeout(20000);

      let change = await Change.create(remoteRepo, head, 'master', fetchOpts);

      let file = await change.get('contents/events/event-1.json', { allowUpdate: true });

      file.setContent(
        JSON.stringify(
          {
            attributes: {
              title: 'This is a test event',
              'published-date': '2018-09-25',
            },
          },
          null,
          2
        )
      );

      await change.finalize({
        authorName: 'John Milton',
        authorEmail: 'john@paradiselost.com',
        message: 'I probably shouldnt update this out of sync',
      });

      let remote = await remoteRepo.getRemote('origin');
      await remote.push(['refs/heads/master:refs/heads/master'], fetchOpts);

      let { data: record } = await writers.update(env.session, 'events', 'event-1', {
        data: {
          id: 'event-1',
          type: 'events',
          attributes: {
            title: 'Updated title',
          },
          meta: {
            version: head,
          },
        },
      });
      expect(record).has.deep.property('attributes.title', 'Updated title');
      expect(record)
        .has.deep.property('meta.version')
        .not.equal(head);

      await repo.fetch('origin', fetchOpts);
      let updated = await inRepo(tempRemoteRepoPath).getJSONContents('origin/master', `contents/events/event-1.json`);

      expect(updated).to.deep.equal({
        attributes: {
          title: 'Updated title',
          'published-date': '2018-09-25',
        },
      });
    });
  });

  describe('delete', function() {
    it('deletes document', async function() {
      await writers.delete(env.session, head, 'events', 'event-1');

      await repo.fetch('origin', fetchOpts);

      let articles = (await inRepo(tempRemoteRepoPath).listTree('origin/master', 'contents/events')).map(a => a.name);
      expect(articles).to.not.contain('event-1.json');
    });

    // TODO: come up with testing scenarios for conflicts
  });
});

describe('git/writer with empty remote', function() {
  let env: todo, writers: todo, repo: Repository, tempRepoPath, tempRemoteRepoPath: string;

  this.timeout(10000);

  beforeEach(async function() {
    let root = await temp.mkdir('cardstack-server-test');

    let { repo: remoteRepo } = await makeRepo(root);

    let remote = await Remote.create(remoteRepo, 'origin', 'ssh://root@localhost:9022/root/data-test');
    await remote.push(['+refs/heads/master:refs/heads/master'], fetchOpts);

    let factory = new JSONAPIFactory();

    tempRepoPath = await mkdir('cardstack-temp-test-repo');
    tempRemoteRepoPath = await mkdir('cardstack-temp-test-remote-repo');

    repo = await Repository.clone('ssh://root@localhost:9022/root/data-test', tempRemoteRepoPath, {
      fetchOpts,
    });

    let dataSource = factory.addResource('data-sources').withAttributes({
      'source-type': '@cardstack/git',
      params: {
        remote: {
          url: 'ssh://root@localhost:9022/root/data-test',
          privateKey,
          cacheDir: tempRepoPath,
        },
      },
    });

    factory
      .addResource('content-types', 'events')
      .withRelated('fields', [
        factory.addResource('fields', 'title').withAttributes({ fieldType: '@cardstack/core-types::string' }),
        factory.addResource('fields', 'published-date').withAttributes({ fieldType: '@cardstack/core-types::string' }),
      ])
      .withRelated('data-source', dataSource);

    env = await createDefaultEnvironment(`${__dirname}/..`, factory.getModels());
    writers = env.lookup('hub:writers');
  });

  afterEach(async function() {
    await temp.cleanup();
    await destroyDefaultEnvironment(env);
    service.clearCache();
  });

  describe('create', function() {
    it('allows you to create a record in an empty git repo', async function() {
      let { data: record } = await writers.create(env.session, 'events', {
        data: {
          type: 'events',
          attributes: {
            title: 'Fresh Event',
            'published-date': '2018-09-01',
          },
        },
      });
      await repo.fetch('origin', fetchOpts);
      let saved = await inRepo(tempRemoteRepoPath).getJSONContents(
        'origin/master',
        `contents/events/${record.id}.json`
      );
      expect(saved).to.deep.equal({
        attributes: {
          title: 'Fresh Event',
          'published-date': '2018-09-01',
        },
      });
    });
  });
});

describe('git/writer-remote/githereum', function() {
  let env: todo, writers: todo, tempRepoPath, tempRemoteRepoPath, githereum: todo, fakeContract: todo, writer;
  this.timeout(20000);

  beforeEach(async function() {
    await resetRemote();

    let factory = new JSONAPIFactory();

    tempRepoPath = await mkdir('cardstack-temp-test-repo');
    tempRemoteRepoPath = await mkdir('cardstack-temp-test-remote-repo');

    await Repository.clone('ssh://root@localhost:9022/root/data-test', tempRemoteRepoPath, {
      fetchOpts,
    });

    let dataSource = factory.addResource('data-sources', 'git').withAttributes({
      'source-type': '@cardstack/git',
      params: {
        remote: {
          url: 'ssh://root@localhost:9022/root/data-test',
          privateKey,
          cacheDir: tempRepoPath,
        },
        githereum: {
          contractAddress: '0xD8B92BE4420Fe70b62FF5e5F8eE5CF87871952e1',
          tag: 'test-tag',
          repoName: 'githereum-repo',
        },
      },
    });

    factory
      .addResource('content-types', 'articles')
      .withRelated('fields', [
        factory.addResource('fields', 'title').withAttributes({ fieldType: '@cardstack/core-types::string' }),
        factory
          .addResource('fields', 'primary-image')
          .withAttributes({ fieldType: '@cardstack/core-types::belongs-to' }),
      ])
      .withRelated('data-source', dataSource);

    env = await createDefaultEnvironment(`${__dirname}/..`, factory.getModels());
    writers = env.lookup('hub:writers');

    let schema = await writers.currentSchema.getSchema();
    writer = schema.getDataSource('git').writer;

    fakeContract = {};
    replace(writer, '_getGithereumContract', fake.returns(fakeContract));
    await writer._ensureGithereum();
    githereum = writer.githereum;
  });

  afterEach(async function() {
    await temp.cleanup();
    await destroyDefaultEnvironment(env);
    service.clearCache();
  });

  it('writes to githereum if configured when writing', async function() {
    let fakePush = fake.returns(new Promise(resolve => resolve()));

    replace(githereum, 'push', fakePush);

    await writers.create(env.session, 'articles', {
      data: {
        type: 'articles',
        attributes: {
          title: 'An article',
        },
      },
    });

    let repo = await Repository.open(githereum.repoPath);
    let firstCommitOnMaster = await repo.getMasterCommit();

    let history = await firstCommitOnMaster.getLog();

    expect(history.length).to.equal(2);

    expect(githereum.contract).to.equal(fakeContract);
    expect(githereum.repoName).to.equal('githereum-repo');

    // push is called with the correct tag
    expect(fakePush.callCount).to.equal(1);
    expect(fakePush.calledWith('test-tag')).to.be.ok;
  });
});
