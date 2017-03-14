const Writers = require('@cardstack/server/writers');
const Writer = require('@cardstack/git/writer');
const { inRepo } = require('./support');
const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('@cardstack/server/tests/support');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
const { grantAllPermissions } = require('@cardstack/test-support/permissions');

describe('git/writer', function() {

  let env, writers, user;

  beforeEach(async function() {
    let factory = new JSONAPIFactory();

    grantAllPermissions(factory);

    factory.addResource('content-types', 'articles')
      .withRelated('data-source', { type: 'data-sources', id: 'default-git' })
      .withRelated('fields', [
        factory.addResource('fields', 'title').withAttributes({ fieldType: 'string' })
      ]);

    factory.addResource('content-types', 'people')
      .withRelated('data-source', { type: 'data-sources', id: 'default-git' })
      .withRelated('fields', [
        factory.addResource('fields', 'first-name').withAttributes({ fieldType: 'string' }),
        factory.addResource('fields', 'last-name').withAttributes({ fieldType: 'string' }),
        factory.addResource('fields', 'age').withAttributes({ fieldType: 'integer' })
      ]);

    factory.addResource('articles', 1)
      .withAttributes({
          title: 'First Article'
      });

    factory.addResource('people', 1)
      .withAttributes({
        firstName: 'Quint',
        lastName: 'Faulkner',
        age: 6
      });

    factory.addResource('people', 2)
      .withAttributes({
        firstName: 'Arthur',
        lastName: 'Faulkner',
        age: 1
      });

    env = await createDefaultEnvironment(factory.getModels());

    user = {
      fullName: 'Sample User',
      email: 'user@example.com'
    };

    writers = new Writers(env.schemaCache);

  });

  afterEach(async function() {
    await destroyDefaultEnvironment(env);
  });

  describe('create', function() {
    it('saves attributes', async function () {
      let record = await writers.create('master', user, 'articles', {
        type: 'articles',
        attributes: {
          title: 'Second Article'
        }
      });
      let saved = await inRepo(env.repoPath).getJSONContents('master', `contents/articles/${record.id}.json`);
      expect(saved).to.deep.equal({
        attributes: {
          title: 'Second Article'
        }
      });
    });

    it('returns correct document', async function () {
      let record = await writers.create('master', user, 'articles', {
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
      let head = await inRepo(env.repoPath).getCommit('master');
      expect(record).has.deep.property('meta.version', head.id);
    });

    it('retries on id collision', async function () {
      let ids = ['1', '1', '2'];
      let writer = new Writer({
        repo: env.repoPath,
        idGenerator() {
          return ids.shift();
        }
      });

      let pending = await writer.prepareCreate('master', user, 'articles', {
        type: 'articles',
        attributes: {
          title: 'Second Article'
        }
      });
      expect(ids).to.have.length(0);
      expect(pending.finalDocument).has.property('id', '2');
    });

    it('allows optional clientside id', async function() {
      let record = await writers.create('master', user, 'articles', {
        id: 'special',
        type: 'articles',
        attributes: {
          title: 'Second Article'
        }
      });
      expect(record).has.property('id', 'special');
      let articles = (await inRepo(env.repoPath).listTree('master', 'contents/articles')).map(a => a.name);
      expect(articles).to.contain('special.json');
    });

    it('rejects conflicting clientside id', async function() {
      try {
        await writers.create('master', user, 'articles', {
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
        await writers.create('master', user, 'articles', {
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
        expect(err.detail).to.match(/missing required field "type"/);
        expect(err.source).to.deep.equal({ pointer: '/data/type' });
      }
    });

    it('rejects mismatched type', async function() {
      try {
        await writers.create('master', user, 'articles', {
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
        await writers.update('master', user, 'articles', '1', {
          type: 'articles',
          attributes: {
            title: 'Updated title'
          },
          meta: {
            version: env.head
          }
        });
        throw new Error("should not get here");
      } catch (err) {
        if (!err.status) { throw err; }
        expect(err.status).to.equal(400);
        expect(err.detail).to.match(/missing required field/);
        expect(err.source).to.deep.equal({ pointer: '/data/id' });
      }
    });

    it('requires type in body', async function() {
      try {
        await writers.update('master', user, 'articles', '1', {
          id: '1',
          attributes: {
            title: 'Updated title'
          },
          meta: {
            version: env.head
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
        await writers.update('master', user, 'articles', '1', {
          id: '1',
          type: 'events',
          attributes: {
            title: 'Updated title'
          },
          meta: {
            version: env.head
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
        await writers.update('master', user, 'articles', '10', {
          id: '10',
          type: 'articles',
          attributes: {
            title: 'Updated title'
          },
          meta: {
            version: env.head
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
          await writers.update('master', user, 'articles', '1', doc);
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
          await writers.update('master', user, 'articles', '1', {
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
      let record = await writers.update('master', user, 'articles', '1', {
        id: '1',
        type: 'articles',
        attributes: {
          title: 'Updated title'
        },
        meta: {
          version: env.head
        }
      });
      expect(record).has.deep.property('attributes.title', 'Updated title');
      expect(record).has.deep.property('meta.version').not.equal(env.head);
    });

    it('returns unchanged field', async function() {
      let record = await writers.update('master', user, 'people', '1', {
        id: '1',
        type: 'people',
        attributes: {
          age: 7
        },
        meta: {
          version: env.head
        }
      });
      expect(record).has.deep.property('attributes.first-name').equal('Quint');
    });

    it('stores unchanged field', async function() {
      await writers.update('master', user, 'people', '1', {
        id: '1',
        type: 'people',
        attributes: {
          age: 7
        },
        meta: {
          version: env.head
        }
      });
      expect(await inRepo(env.repoPath).getJSONContents('master', 'contents/people/1.json'))
        .deep.property('attributes.first-name', 'Quint');
    });

    it('stores updated attribute', async function() {
      await writers.update('master', user, 'articles', '1', {
        id: '1',
        type: 'articles',
        attributes: {
          title: 'Updated title'
        },
        meta: {
          version: env.head
        }
      });
      expect(await inRepo(env.repoPath).getJSONContents('master', 'contents/articles/1.json'))
        .deep.property('attributes.title', 'Updated title');
    });

    it('reports merge conflict', async function() {
      await writers.update('master', user, 'articles', '1', {
        id: '1',
        type: 'articles',
        attributes: {
          title: 'Updated title'
        },
        meta: {
          version: env.head
        }
      });

      try {
        await writers.update('master', user, 'articles', '1', {
          id: '1',
          type: 'articles',
          attributes: {
            title: 'Conflicting title'
          },
          meta: {
            version: env.head
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

    it('refuses to update id', async function() {
      try {
        await writers.update('master', user, 'articles', '1', {
          id: '12',
          type: 'articles',
          meta: {
            version: env.head
          }
        });
        throw new Error("should not get here");
      } catch(err) {
        if (!err.status) {
          throw err;
        }
        expect(err.status).to.equal(403);
        expect(err.detail).to.equal('not allowed to change "id"');
      }
    });


    it('refuses to update type', async function() {
      try {
        await writers.update('master', user, 'articles', '1', {
          id: '1',
          type: 'articles2',
          meta: {
            version: env.head
          }
        });
        throw new Error("should not get here");
      } catch(err) {
        if (!err.status) {
          throw err;
        }
        expect(err.status).to.equal(409);
        expect(err.detail).to.equal('the type "articles2" is not allowed here');
      }
    });


  });

  describe('delete', function() {

    it('rejects missing document', async function() {
      try {
        await writers.delete('master', user, env.head, 'articles', '10');
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
        await writers.delete('master', user, null, 'articles', '1');
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
          await writers.delete('master', user, version, 'articles', '1');
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
      await writers.delete('master', user, env.head, 'people', '1');
      let articles = (await inRepo(env.repoPath).listTree('master', 'contents/people')).map(a => a.name);
      expect(articles).to.not.contain('1.json');
    });

    it('reports merge conflict', async function() {
      await writers.update('master', user, 'articles', '1', {
        id: '1',
        type: 'articles',
        attributes: {
          title: 'Updated title'
        },
        meta: {
          version: env.head
        }
      });

      try {
        await writers.delete('master', user, env.head, 'articles', '1');
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
      let record = await writers.create('master', user, 'articles', {
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
      let saved = await inRepo(env.repoPath).getJSONContents('master', `contents/articles/${record.id}.json`);
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
      let record = await writers.create('master', user, 'articles', {
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
      await writers.update('master', user, 'articles', '1', {
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
          version: env.head
        }
      });
      let saved = await inRepo(env.repoPath).getJSONContents('master', `contents/articles/1.json`);
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
      let record = await writers.update('master', user, 'articles', '1', {
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
          version: env.head
        }
      });
      expect(record).to.have.deep.property('relationships.primaryImage.data.id', '100');
      expect(record).to.have.deep.property('relationships.primaryImage.data.type', 'images');
    });


  });



});
