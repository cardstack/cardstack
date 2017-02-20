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

  before(async function() {
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

  after(async function() {
    await temp.cleanup();
  });

  it('creates a record', async function () {
    let record = await writer.create('master', user, {
      type: 'articles',
      attributes: {
        title: 'Second Article'
      }
    });
    expect(record).has.property('id');
    expect(await inRepo(root).getJSONContents('master', `contents/articles/${record.id}.json`)).to.deep.equal({
      title: 'Second Article'
    });
  });

});
