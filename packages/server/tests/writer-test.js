const temp = require('./temp-helper');
const Writer = require('@cardstack/server/writer');
const { makeRepo, inRepo } = require('./git-assertions');

describe('writer', function() {

  let fixtures = [
    {
      type: 'articles',
      id: '1',
      content: {
        title: 'First Article'
      }
    },
    {
      type: 'people',
      id: '1',
      content: {
        firstName: 'Quint',
        lastName: 'Faulkner',
        age: 6
      }
    },
    {
      type: 'people',
      id: '2',
      content: {
        firstName: 'Arthur',
        lastName: 'Faulkner',
        age: 1
      }
    }
  ];

  let root, writer, user;

  beforeEach(async function() {
    root = await temp.mkdir('cardstack-server-test');
    writer = new Writer({
      repoPath: root
    });
    user = {
      fullName: 'Sample User',
      email: 'user@example.com'
    };

    await makeRepo(root, [
      {
        changes: fixtures.map(f => ({
          operation: 'create',
          filename: `contents/${f.type}/${f.id}.json`,
          buffer: Buffer.from(JSON.stringify(f.content), 'utf8')
        }))
      }
    ]);
  });

  afterEach(async function() {
    await temp.cleanup();
  });

  it('saves attributes when creating a record', async function () {
    let record = await writer.create('master', user, {
      type: 'articles',
      attributes: {
        title: 'Second Article'
      }
    });
    let saved = await inRepo(root).getJSONContents('master', `contents/articles/${record.id}.json`);
    expect(saved).to.deep.equal({
      title: 'Second Article'
    });
  });

  it('returns correct document when creating a record', async function () {
    let record = await writer.create('master', user, {
      type: 'articles',
      attributes: {
        title: 'Second Article'
      }
    });
    expect(record).has.property('id');
    expect(record.attributes).to.deep.equal({ title: 'Second Article' });
    expect(record.type).to.equal('articles');
    let head = await inRepo(root).getCommit('master');
    expect(record).has.deep.property('meta.version', head.id);
  });

  it('retries on id collision', async function () {
    let ids = ['1', '1', '2'];
    let writer = new Writer({
      repoPath: root,
      idGenerator() {
        return ids.shift();
      }
    });

    let record = await writer.create('master', user, {
      type: 'articles',
      attributes: {
        title: 'Second Article'
      }
    });
    expect(ids).to.have.length(0);
    expect(record).has.property('id', '2');
  });

  it('refuses to update without meta version', async function() {
    try {
      await writer.update('master', user, {
        id: '1',
        type: 'articles',
        attributes: {
          title: 'Updated title'
        }
      });
      throw new Error("should not get here");
    } catch (err) {
      expect(err.status).to.equal(400);
      expect(err.detail).to.match(/missing required information/);
      expect(err.source).to.deep.equal({ pointer: '/data/meta/version' });
    }
  });

});
