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

// this is a known commit that is at the head of the remote repo
const REMOTE_HEAD = 'e2c073f7a4f97662990df39c51fa942ee22f4542';
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

const mkdir = promisify(temp.mkdir);

describe('git/writer with remote', function() {

  let env, writers, repo, tempRepoPath;

  beforeEach(async function() {
    let factory = new JSONAPIFactory();

    tempRepoPath = await mkdir('cardstack-temp-test-repo');

    repo = await Clone('ssh://root@localhost:9022/root/data-test', tempRepoPath, {
      fetchOpts,
    });

    let dataSource = factory.addResource('data-sources')
        .withAttributes({
          'source-type': '@cardstack/git',
          params: {
            remote: {
              url: 'ssh://root@localhost:9022/root/data-test',
              privateKey
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
    // await temp.cleanup();
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
      let saved = await inRepo(tempRepoPath).getJSONContents('origin/master', `contents/events/${record.id}.json`);
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
      let updated = await inRepo(tempRepoPath).getJSONContents('origin/master', `contents/events/event-1.json`);

      expect(updated).to.deep.equal({
        attributes: {
          title: 'Updated title',
          'published-date': '2018-09-25',
        }
      });
    });

    // it.skip('reports merge conflict', async function() {
    //   await writers.update('master', env.session, 'articles', '1', {
    //     data: {
    //       id: '1',
    //       type: 'articles',
    //       attributes: {
    //         title: 'Updated title'
    //       },
    //       meta: {
    //         version: head
    //       }
    //     }
    //   });
    //
    //   try {
    //     await writers.update('master', env.session, 'articles', '1', {
    //       data: {
    //         id: '1',
    //         type: 'articles',
    //         attributes: {
    //           title: 'Conflicting title'
    //         },
    //         meta: {
    //           version: head
    //         }
    //       }
    //     });
    //     throw new Error("should not get here");
    //   } catch (err) {
    //     if (!err.status) {
    //       throw err;
    //     }
    //     expect(err.status).to.equal(409);
    //     expect(err.detail).to.match(/merge conflict/i);
    //   }
    // });
  });

  describe('delete', function() {
    // it.skip('deletes document', async function() {
    //   await writers.delete('master', env.session, head, 'people', '1');
    //   let articles = (await inRepo(repoPath).listTree('master', 'contents/people')).map(a => a.name);
    //   expect(articles).to.not.contain('1.json');
    // });
    //
    // it.skip('reports merge conflict', async function() {
    //   await writers.update('master', env.session, 'articles', '1', {
    //     data: {
    //       id: '1',
    //       type: 'articles',
    //       attributes: {
    //         title: 'Updated title'
    //       },
    //       meta: {
    //         version: head
    //       }
    //     }
    //   });
    //
    //   try {
    //     await writers.delete('master', env.session, head, 'articles', '1');
    //     throw new Error("should not get here");
    //   } catch (err) {
    //     if (!err.status) {
    //       throw err;
    //     }
    //     expect(err.status).to.equal(409);
    //     expect(err.detail).to.match(/merge conflict/i);
    //   }
    // });
  });
});
