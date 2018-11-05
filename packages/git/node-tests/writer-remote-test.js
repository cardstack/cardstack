const {
  Cred,
  Clone,
  Reset
} = require('nodegit');

const { inRepo } = require('./support');
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

// this is a known commit that is at the head of the remote repo
const REMOTE_HEAD = 'e9ad9f2666a4eff985706dfb2e11aa10491100d7';
const privateKey = readFileSync(join(__dirname, 'git-ssh-server', 'cardstack-test-key'), 'utf8');

const fetchOpts = {
  callbacks: {
    credentials: (url, userName) => {
      return Cred.sshKeyMemoryNew(userName, '', privateKey, '');
    }
  }
};

async function resetRemote(repo) {
  let commit = await repo.getCommit(REMOTE_HEAD);
  await Reset.reset(repo, commit, Reset.TYPE.HARD);
  let remote = await repo.getRemote('origin');
  await remote.push(["+refs/heads/master:refs/heads/master"], fetchOpts);
}

describe('git/writer with remote', function() {
  let env, writers, repo, tempRepoPath, tempRemoteRepoPath;

  beforeEach(async function() {
    let factory = new JSONAPIFactory();

    tempRepoPath = await mkdir('cardstack-temp-test-repo');
    tempRemoteRepoPath = await mkdir('cardstack-temp-test-remote-repo');

    repo = await Clone('ssh://root@localhost:9022/root/data-test', tempRemoteRepoPath, {
      fetchOpts,
    });

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

    factory.addResource('content-types', 'events')
      .withRelated('fields', [
        factory.addResource('fields', 'title').withAttributes({ fieldType: '@cardstack/core-types::string' }),
        factory.addResource('fields', 'published-date').withAttributes({ fieldType: '@cardstack/core-types::string' })
      ]).withRelated('data-source', dataSource);

    factory.addResource('plugin-configs', '@cardstack/hub')
      .withRelated(
        'default-data-source',
        dataSource
      );

    env = await createDefaultEnvironment(`${__dirname}/..`, factory.getModels());
    writers = env.lookup('hub:writers');
  });

  afterEach(async function() {
    await resetRemote(repo);
    await temp.cleanup();
    await destroyDefaultEnvironment(env);
  });

  describe('create', function() {
    it('saves attributes', async function () {
      let { data:record } = await writers.create('master', env.session, 'events', {
        data: {
          type: 'events',
          attributes: {
            title: 'Second Event',
            'published-date': '2018-09-01',
          }
        }
      });
      await repo.fetch('origin', fetchOpts);
      let saved = await inRepo(tempRemoteRepoPath).getJSONContents('origin/master', `contents/events/${record.id}.json`);
      expect(saved).to.deep.equal({
        attributes: {
          title: 'Second Event',
          'published-date': '2018-09-01',
        }
      });
    });
  });

  describe('update', function() {
    it('returns updated document', async function() {
      let { data:record } = await writers.update('master', env.session, 'events', 'event-1', {
        data: {
          id: 'event-1',
          type: 'events',
          attributes: {
            title: 'Updated title'
          },
          meta: {
            version: REMOTE_HEAD
          }
        }
      });
      expect(record).has.deep.property('attributes.title', 'Updated title');
      expect(record).has.deep.property('meta.version').not.equal(REMOTE_HEAD);


      await repo.fetch('origin', fetchOpts);
      let updated = await inRepo(tempRemoteRepoPath).getJSONContents('origin/master', `contents/events/event-1.json`);

      expect(updated).to.deep.equal({
        attributes: {
          title: 'Updated title',
          'published-date': '2018-09-25',
        }
      });
    });

    // TODO: come up with testing scenarios for conflicts
  });

  describe('delete', function() {
    it('deletes document', async function() {
      await writers.delete('master', env.session, REMOTE_HEAD, 'events', 'event-1');

      await repo.fetch('origin', fetchOpts);

      let articles = (await inRepo(tempRemoteRepoPath).listTree('origin/master', 'contents/events')).map(a => a.name);
      expect(articles).to.not.contain('event-1.json');
    });

    // TODO: come up with testing scenarios for conflicts
  });
});
