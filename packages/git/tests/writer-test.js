const temp = require('@cardstack/data-source/tests/temp-helper');
const Writer = require('@cardstack/git/writer');
const { makeRepo, inRepo } = require('./support');

describe('git writer', function() {

  let fixtures = [
    {
      type: 'articles',
      id: '1',
      attributes: {
        title: 'First Article'
      }
    },
    {
      type: 'people',
      id: '1',
      attributes: {
        firstName: 'Quint',
        lastName: 'Faulkner',
        age: 6
      }
    },
    {
      type: 'people',
      id: '2',
      attributes: {
        firstName: 'Arthur',
        lastName: 'Faulkner',
        age: 1
      }
    }
  ];

  let root, writer, user, headId;

  beforeEach(async function() {
    root = await temp.mkdir('cardstack-server-test');
    writer = new Writer({
      repo: root
    });
    user = {
      fullName: 'Sample User',
      email: 'user@example.com'
    };

    let { head } = await makeRepo(root, [
      {
        changes: fixtures.map(f => ({
          operation: 'create',
          filename: `contents/${f.type}/${f.id}.json`,
          buffer: Buffer.from(JSON.stringify({ attributes: f.attributes }), 'utf8')
        }))
      }
    ]);
    headId = head;
  });

  afterEach(async function() {
    await temp.cleanup();
  });

  describe('create', function() {
    it('saves attributes', async function () {
      let record = await writer.create('master', user, 'articles', {
        type: 'articles',
        attributes: {
          title: 'Second Article'
        }
      });
      let saved = await inRepo(root).getJSONContents('master', `contents/articles/${record.id}.json`);
      expect(saved).to.deep.equal({
        attributes: {
          title: 'Second Article'
        }
      });
    });

    it('returns correct document', async function () {
      let record = await writer.create('master', user, 'articles', {
        type: 'articles',
        attributes: {
          title: 'Second Article'
        }
      });
      expect(record).has.property('id');
      expect(record.attributes).to.deep.equal({
        title: 'Second Article'
      });
      expect(record.type).to.equal('articles');
      let head = await inRepo(root).getCommit('master');
      expect(record).has.deep.property('meta.version', head.id);
    });

    it('retries on id collision', async function () {
      let ids = ['1', '1', '2'];
      let writer = new Writer({
        repo: root,
        idGenerator() {
          return ids.shift();
        }
      });

      let record = await writer.create('master', user, 'articles', {
        type: 'articles',
        attributes: {
          title: 'Second Article'
        }
      });
      expect(ids).to.have.length(0);
      expect(record).has.property('id', '2');
    });

    it('allows optional clientside id', async function() {
      let record = await writer.create('master', user, 'articles', {
        id: 'special',
        type: 'articles',
        attributes: {
          title: 'Second Article'
        }
      });
      expect(record).has.property('id', 'special');
      let articles = (await inRepo(root).listTree('master', 'contents/articles')).map(a => a.name);
      expect(articles).to.contain('special.json');
    });

    it('rejects conflicting clientside id', async function() {
      try {
        await writer.create('master', user, 'articles', {
          id: '1',
          type: 'articles',
          attributes: {
            title: 'Second Article'
          }
        });
        throw new Error("should not get here");
      } catch (err) {
        if (!err.status) {
          throw err;
        }
        expect(err.status).to.equal(409);
        expect(err.detail).to.match(/id 1 is already in use/);
        expect(err.source).to.deep.equal({ pointer: '/data/id' });
      }
    });

    it('requires type in body', async function() {
      try {
        await writer.create('master', user, 'articles', {
          id: '1',
          attributes: {
            title: 'Second Article'
          }
        });
        throw new Error("should not get here");
      } catch (err) {
        if (!err.status) {
          throw err;
        }
        expect(err.status).to.equal(400);
        expect(err.detail).to.match(/missing required field/);
        expect(err.source).to.deep.equal({ pointer: '/data/type' });
      }
    });

    it('rejects mismatched type', async function() {
      try {
        await writer.create('master', user, 'articles', {
          id: '1',
          type: 'events',
          attributes: {
            title: 'Second Article'
          }
        });
        throw new Error("should not get here");
      } catch (err) {
        if (!err.status) {
          throw err;
        }
        expect(err.status).to.equal(409);
        expect(err.detail).to.match(/the type "events" is not allowed here/);
        expect(err.source).to.deep.equal({ pointer: '/data/type' });
      }
    });
  });

  describe('update', function() {

    it('requires id in body', async function() {
      try {
        await writer.update('master', user, 'articles', '1', {
          type: 'articles',
          attributes: {
            title: 'Updated title'
          },
          meta: {
            version: headId
          }
        });
        throw new Error("should not get here");
      } catch (err) {
        expect(err.status).to.equal(400);
        expect(err.detail).to.match(/missing required field/);
        expect(err.source).to.deep.equal({ pointer: '/data/id' });
      }
    });

    it('requires type in body', async function() {
      try {
        await writer.update('master', user, 'articles', '1', {
          id: '1',
          attributes: {
            title: 'Updated title'
          },
          meta: {
            version: headId
          }
        });
        throw new Error("should not get here");
      } catch (err) {
        if (!err.status) {
          throw err;
        }
        expect(err.status).to.equal(400);
        expect(err.detail).to.match(/missing required field/);
        expect(err.source).to.deep.equal({ pointer: '/data/type' });
      }
    });

    it('rejects mismatched type', async function() {
      try {
        await writer.update('master', user, 'articles', '1', {
          id: '1',
          type: 'events',
          attributes: {
            title: 'Updated title'
          },
          meta: {
            version: headId
          }
        });
        throw new Error("should not get here");
      } catch (err) {
        if (!err.status) {
          throw err;
        }
        expect(err.status).to.equal(409);
        expect(err.detail).to.match(/the type "events" is not allowed here/);
        expect(err.source).to.deep.equal({ pointer: '/data/type' });
      }
    });

    it('rejects update of missing document', async function() {
      try {
        await writer.update('master', user, 'articles', '10', {
          id: '10',
          type: 'articles',
          attributes: {
            title: 'Updated title'
          },
          meta: {
            version: headId
          }
        });
        throw new Error("should not get here");
      } catch (err) {
        if (!err.status) {
          throw err;
        }
        expect(err.status).to.equal(404);
        expect(err.title).to.match(/not found/i);
        expect(err.source).to.deep.equal({ pointer: '/data/id' });
      }
    });


    let badMetas = [undefined, null, 0, 1, {}, { version: null }, { version: 0 }, { version: "" }];

    for (let meta of badMetas) {
      it(`refuses to update without meta version (${JSON.stringify(meta)})`, async function() {
        try {
          let doc = {
            id: '1',
            type: 'articles',
            attributes: {
              title: 'Updated title'
            }
          };
          if (meta !== undefined) {
            doc.meta = meta;
          }
          await writer.update('master', user, 'articles', '1', doc);
          throw new Error("should not get here");
        } catch (err) {
          expect(err.status).to.equal(400);
          expect(err.detail).to.match(/missing required field/);
          expect(err.source).to.deep.equal({ pointer: '/data/meta/version' });
        }
      });
    }

    let badVersions = ["0", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "not-a-version"];

    for (let version of badVersions) {
      it(`rejects invalid version ${version}`, async function() {
        try {
          await writer.update('master', user, 'articles', '1', {
            id: '1',
            type: 'articles',
            attributes: {
              title: 'Updated title'
            },
            meta: {
              version
            }
          });
          throw new Error("should not get here");
        } catch (err) {
          if (err.status == null) {
            throw err;
          }
          expect(err.status).to.equal(400);
          expect(err.source).to.deep.equal({ pointer: '/data/meta/version' });
        }
      });
    }

    it('returns updated document', async function() {
      let record = await writer.update('master', user, 'articles', '1', {
        id: '1',
        type: 'articles',
        attributes: {
          title: 'Updated title'
        },
        meta: {
          version: headId
        }
      });
      expect(record).has.deep.property('attributes.title', 'Updated title');
      expect(record).has.deep.property('meta.version').not.equal(headId);
    });

    it.skip('returns unchanged field', async function() {
      let record = await writer.update('master', user, 'people', '1', {
        id: '1',
        type: 'people',
        attributes: {
          age: 7
        },
        meta: {
          version: headId
        }
      });
      expect(record).has.deep.property('attributes.firstName').equal('Quint');
    });

    it('stores unchanged field', async function() {
      await writer.update('master', user, 'people', '1', {
        id: '1',
        type: 'people',
        attributes: {
          age: 7
        },
        meta: {
          version: headId
        }
      });
      expect(await inRepo(root).getJSONContents('master', 'contents/people/1.json'))
        .deep.property('attributes.firstName', 'Quint');
    });

    it('stores updated attribute', async function() {
      await writer.update('master', user, 'articles', '1', {
        id: '1',
        type: 'articles',
        attributes: {
          title: 'Updated title'
        },
        meta: {
          version: headId
        }
      });
      expect(await inRepo(root).getJSONContents('master', 'contents/articles/1.json'))
        .deep.property('attributes.title', 'Updated title');
    });

    it('reports merge conflict', async function() {
      await writer.update('master', user, 'articles', '1', {
        id: '1',
        type: 'articles',
        attributes: {
          title: 'Updated title'
        },
        meta: {
          version: headId
        }
      });

      try {
        await writer.update('master', user, 'articles', '1', {
          id: '1',
          type: 'articles',
          attributes: {
            title: 'Conflicting title'
          },
          meta: {
            version: headId
          }
        });
        throw new Error("should not get here");
      } catch (err) {
        if (!err.status) {
          throw err;
        }
        expect(err.status).to.equal(409);
        expect(err.detail).to.match(/merge conflict/i);
      }
    });
  });

  describe('delete', function() {

    it('rejects missing document', async function() {
      try {
        await writer.delete('master', user, headId, 'articles', '10');
        throw new Error("should not get here");
      } catch (err) {
        if (!err.status) {
          throw err;
        }
        expect(err.status).to.equal(404);
        expect(err.title).to.match(/not found/i);
      }
    });

    it('requires version', async function() {
      try {
        await writer.delete('master', user, null, 'articles', '1');
        throw new Error("should not get here");
      } catch (err) {
        if (!err.status) {
          throw err;
        }
        expect(err.status).to.equal(400);
        expect(err.detail).to.match(/version is required/);
      }
    });

    let badVersions = ["0", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "not-a-version"];
    for (let version of badVersions) {
      it(`rejects invalid version ${version}`, async function() {
        try {
          await writer.delete('master', user, version, 'articles', '1');
          throw new Error("should not get here");
        } catch (err) {
          if (err.status == null) {
            throw err;
          }
          expect(err.status).to.equal(400);
          expect(err.source).to.deep.equal({ pointer: '/data/meta/version' });
        }
      });
    }

    it('deletes document', async function() {
      await writer.delete('master', user, headId, 'people', '1');
      let articles = (await inRepo(root).listTree('master', 'contents/people')).map(a => a.name);
      expect(articles).to.not.contain('1.json');
    });

    it('reports merge conflict', async function() {
      await writer.update('master', user, 'articles', '1', {
        id: '1',
        type: 'articles',
        attributes: {
          title: 'Updated title'
        },
        meta: {
          version: headId
        }
      });

      try {
        await writer.delete('master', user, headId, 'articles', '1');
        throw new Error("should not get here");
      } catch (err) {
        if (!err.status) {
          throw err;
        }
        expect(err.status).to.equal(409);
        expect(err.detail).to.match(/merge conflict/i);
      }
    });
  });

  describe('belongsTo', function() {
    it('saves at creation', async function() {
      let record = await writer.create('master', user, 'articles', {
        type: 'articles',
        relationships: {
          primaryImage: {
            data: {
              type: 'images',
              id: '100'
            }
          }
        },
      });
      let saved = await inRepo(root).getJSONContents('master', `contents/articles/${record.id}.json`);
      expect(saved).to.deep.equal({
        relationships: {
          primaryImage: {
            data: {
              type: 'images',
              id: '100'
            }
          }
        }
      });
    });

    it('echos at creation', async function() {
      let record = await writer.create('master', user, 'articles', {
        type: 'articles',
        relationships: {
          primaryImage: {
            data: {
              type: 'images',
              id: '100'
            }
          }
        },
      });
      expect(record).to.have.deep.property('relationships.primaryImage.data.id', '100');
      expect(record).to.have.deep.property('relationships.primaryImage.data.type', 'images');
    });

    it('saves at update', async function() {
      await writer.update('master', user, 'articles', '1', {
        id: '1',
        type: 'articles',
        relationships: {
          primaryImage: {
            data: {
              type: 'images',
              id: '100'
            }
          }
        },
        meta: {
          version: headId
        }
      });
      let saved = await inRepo(root).getJSONContents('master', `contents/articles/1.json`);
      expect(saved).to.deep.equal({
        attributes: {
          title: 'First Article'
        },
        relationships: {
          primaryImage: {
            data: {
              type: 'images',
              id: '100'
            }
          }
        }
      });
    });

    it('echos at update', async function() {
      let record = await writer.update('master', user, 'articles', '1', {
        id: '1',
        type: 'articles',
        relationships: {
          primaryImage: {
            data: {
              type: 'images',
              id: '100'
            }
          }
        },
        meta: {
          version: headId
        }
      });
      expect(record).to.have.deep.property('relationships.primaryImage.data.id', '100');
      expect(record).to.have.deep.property('relationships.primaryImage.data.type', 'images');
    });

  });



});
