const Writer = require('../writer');
const { inRepo } = require('./support');
const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('@cardstack/test-support/env');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
const temp = require('@cardstack/test-support/temp-helper');
const { makeRepo } = require('./support');

describe('git/writer', function() {

  let env, writers, repoPath, head;

  beforeEach(async function() {
    repoPath = await temp.mkdir('git-writer-test');
    await makeRepo(repoPath);

    let factory = new JSONAPIFactory();

    factory.addResource('plugin-configs').withAttributes({
      module: '@cardstack/git'
    });

    let source = factory.addResource('data-sources')
      .withAttributes({
        'source-type': '@cardstack/git',
        params: { repo: repoPath }
      });

    factory.addResource('content-types', 'articles')
      .withRelated('fields', [
        factory.addResource('fields', 'title').withAttributes({ fieldType: '@cardstack/core-types::string' }),
        factory.addResource('fields', 'primary-image').withAttributes({ fieldType: '@cardstack/core-types::belongs-to' })
      ]).withRelated('data-source', source);

    factory.addResource('content-types', 'people')
      .withRelated('fields', [
        factory.addResource('fields', 'first-name').withAttributes({ fieldType: '@cardstack/core-types::string' }),
        factory.addResource('fields', 'last-name').withAttributes({ fieldType: '@cardstack/core-types::string' }),
        factory.addResource('fields', 'age').withAttributes({ fieldType: '@cardstack/core-types::integer' })
      ]).withRelated('data-source', source);

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

    factory.addResource('content-types', 'things-with-defaults')
      .withRelated('fields', [
        factory.addResource('fields', 'coolness')
          .withAttributes({
            fieldType: '@cardstack/core-types::integer'
          }).withRelated(
            'defaultAtCreate',
            factory.addResource('default-values').withAttributes({ value: 42 })
          ),
        factory.addResource('fields', 'karma')
          .withAttributes({
            fieldType: '@cardstack/core-types::integer'
          }).withRelated(
            'defaultAtUpdate',
            factory.addResource('default-values').withAttributes({ value: 0 })
          )
      ]).withRelated('data-source', source);

    factory.addResource('things-with-defaults', 4)
      .withAttributes({
        coolness: 100,
        karma: 10
      });

    env = await createDefaultEnvironment(`${__dirname}/..`, factory.getModels());
    head = (await inRepo(repoPath).getCommit('master')).id;
    writers = env.lookup('hub:writers');
  });

  afterEach(async function() {
    await temp.cleanup();
    await destroyDefaultEnvironment(env);
  });

  describe('create', function() {
    it('saves attributes', async function () {
      let record = await writers.create('master', env.session, 'articles', {
        type: 'articles',
        attributes: {
          title: 'Second Article'
        }
      });
      let saved = await inRepo(repoPath).getJSONContents('master', `contents/articles/${record.id}.json`);
      expect(saved).to.deep.equal({
        attributes: {
          title: 'Second Article'
        },
        relationships: {
          'primary-image': null
        }
      });
    });

    it('emits changed event', async function () {
      let log = [];
      writers.on('changed', message => log.push(message));
      await writers.create('master', env.session, 'articles', {
        type: 'articles',
        attributes: {
          title: 'Second Article'
        }
      });
      expect(log).length(1);
    });


    it('saves default attribute', async function() {
      await writers.create('master', env.session, 'things-with-defaults', {
        id: '1',
        type: 'things-with-defaults',
      });
      expect(await inRepo(repoPath).getJSONContents('master', 'contents/things-with-defaults/1.json'))
        .deep.property('attributes.coolness', 42);
    });


    it('returns correct document', async function () {
      let record = await writers.create('master', env.session, 'articles', {
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
      let head = await inRepo(repoPath).getCommit('master');
      expect(record).has.deep.property('meta.version', head.id);
    });

    it('returns default attribute', async function() {
      let record = await writers.create('master', env.session, 'things-with-defaults', {
        id: '1',
        type: 'things-with-defaults',
      });
      expect(record.attributes).to.deep.equal({
        coolness: 42,
        karma: 0
      });
    });

    it('retries on id collision', async function () {
      let ids = ['1', '1', '2'];
      let writer = new Writer({
        repo: repoPath,
        idGenerator() {
          return ids.shift();
        }
      });

      let pending = await writer.prepareCreate('master', env.session, 'articles', {
        type: 'articles',
        attributes: {
          title: 'Second Article'
        }
      }, false);
      expect(ids).to.have.length(0);
      expect(pending.finalDocument).has.property('id', '2');
    });

    it('allows optional clientside id', async function() {
      let record = await writers.create('master', env.session, 'articles', {
        id: 'special',
        type: 'articles',
        attributes: {
          title: 'Second Article'
        }
      });
      expect(record).has.property('id', 'special');
      let articles = (await inRepo(repoPath).listTree('master', 'contents/articles')).map(a => a.name);
      expect(articles).to.contain('special.json');
    });

    it('rejects conflicting clientside id', async function() {
      try {
        await writers.create('master', env.session, 'articles', {
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
        await writers.create('master', env.session, 'articles', {
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
        await writers.create('master', env.session, 'articles', {
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
        await writers.update('master', env.session, 'articles', '1', {
          type: 'articles',
          attributes: {
            title: 'Updated title'
          },
          meta: {
            version: head
          }
        });
        throw new Error("should not get here");
      } catch (err) {
        if (!err.isCardstackError) { throw err; }
        expect(err.detail).to.match(/missing required field/);
        expect(err.source).to.deep.equal({ pointer: '/data/id' });
        expect(err).hasStatus(400);
      }
    });

    it('requires type in body', async function() {
      try {
        await writers.update('master', env.session, 'articles', '1', {
          id: '1',
          attributes: {
            title: 'Updated title'
          },
          meta: {
            version: head
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
        await writers.update('master', env.session, 'articles', '1', {
          id: '1',
          type: 'events',
          attributes: {
            title: 'Updated title'
          },
          meta: {
            version: head
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
        await writers.update('master', env.session, 'articles', '10', {
          id: '10',
          type: 'articles',
          attributes: {
            title: 'Updated title'
          },
          meta: {
            version: head
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
          await writers.update('master', env.session, 'articles', '1', doc);
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
          await writers.update('master', env.session, 'articles', '1', {
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
      let record = await writers.update('master', env.session, 'articles', '1', {
        id: '1',
        type: 'articles',
        attributes: {
          title: 'Updated title'
        },
        meta: {
          version: head
        }
      });
      expect(record).has.deep.property('attributes.title', 'Updated title');
      expect(record).has.deep.property('meta.version').not.equal(head);
    });


    it('emits changed event', async function() {
      let log = [];
      writers.on('changed', message => log.push(message));
      await writers.update('master', env.session, 'articles', '1', {
        id: '1',
        type: 'articles',
        attributes: {
          title: 'Updated title'
        },
        meta: {
          version: head
        }
      });
      expect(log).length(1);
    });

    it('returns unchanged field', async function() {
      let record = await writers.update('master', env.session, 'people', '1', {
        id: '1',
        type: 'people',
        attributes: {
          age: 7
        },
        meta: {
          version: head
        }
      });
      expect(record).has.deep.property('attributes.first-name').equal('Quint');
    });

    it('returns default attribute value', async function() {
      let record = await writers.update('master', env.session, 'things-with-defaults', '4', {
        id: '4',
        type: 'things-with-defaults',
        meta: {
          version: head
        }
      });

      expect(record).has.deep.property('attributes.coolness').equal(100);
      expect(record).has.deep.property('attributes.karma').equal(0);
    });

    it('stores unchanged field', async function() {
      await writers.update('master', env.session, 'people', '1', {
        id: '1',
        type: 'people',
        attributes: {
          age: 7
        },
        meta: {
          version: head
        }
      });
      expect(await inRepo(repoPath).getJSONContents('master', 'contents/people/1.json'))
        .deep.property('attributes.first-name', 'Quint');
    });

    it('stores updated attribute', async function() {
      await writers.update('master', env.session, 'articles', '1', {
        id: '1',
        type: 'articles',
        attributes: {
          title: 'Updated title'
        },
        meta: {
          version: head
        }
      });
      expect(await inRepo(repoPath).getJSONContents('master', 'contents/articles/1.json'))
        .deep.property('attributes.title', 'Updated title');
    });

    it('stores default attribute', async function() {
      await writers.update('master', env.session, 'things-with-defaults', '4', {
        id: '4',
        type: 'things-with-defaults',
        meta: {
          version: head
        }
      });
      expect(await inRepo(repoPath).getJSONContents('master', 'contents/things-with-defaults/4.json'))
        .deep.property('attributes.coolness', 100);
      expect(await inRepo(repoPath).getJSONContents('master', 'contents/things-with-defaults/4.json'))
        .deep.property('attributes.karma', 0);
    });

    it('reports merge conflict', async function() {
      await writers.update('master', env.session, 'articles', '1', {
        id: '1',
        type: 'articles',
        attributes: {
          title: 'Updated title'
        },
        meta: {
          version: head
        }
      });

      try {
        await writers.update('master', env.session, 'articles', '1', {
          id: '1',
          type: 'articles',
          attributes: {
            title: 'Conflicting title'
          },
          meta: {
            version: head
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
        await writers.update('master', env.session, 'articles', '1', {
          id: '12',
          type: 'articles',
          meta: {
            version: head
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
        await writers.update('master', env.session, 'articles', '1', {
          id: '1',
          type: 'articles2',
          meta: {
            version: head
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

    it('can null out a field', async function() {
      await writers.update('master', env.session, 'articles', '1', {
        id: '1',
        type: 'articles',
        attributes: {
          title: null
        },
        meta: {
          version: head
        }
      });
      let contents = await inRepo(repoPath).getJSONContents('master', 'contents/articles/1.json');
      expect(contents.attributes).deep.equals({
        title: null
      });
    });
  });

  describe('delete', function() {

    it('rejects missing document', async function() {
      try {
        await writers.delete('master', env.session, head, 'articles', '10');
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
        await writers.delete('master', env.session, null, 'articles', '1');
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
          await writers.delete('master', env.session, version, 'articles', '1');
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
      await writers.delete('master', env.session, head, 'people', '1');
      let articles = (await inRepo(repoPath).listTree('master', 'contents/people')).map(a => a.name);
      expect(articles).to.not.contain('1.json');
    });

    it('emits changed event', async function() {
      let log = [];
      writers.on('changed', message => log.push(message));
      await writers.delete('master', env.session, head, 'people', '1');
      expect(log).length(1);
    });

    it('reports merge conflict', async function() {
      await writers.update('master', env.session, 'articles', '1', {
        id: '1',
        type: 'articles',
        attributes: {
          title: 'Updated title'
        },
        meta: {
          version: head
        }
      });

      try {
        await writers.delete('master', env.session, head, 'articles', '1');
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
      let record = await writers.create('master', env.session, 'articles', {
        type: 'articles',
        relationships: {
          'primary-image': {
            data: {
              type: 'images',
              id: '100'
            }
          }
        },
      });
      let saved = await inRepo(repoPath).getJSONContents('master', `contents/articles/${record.id}.json`);
      expect(saved).to.deep.equal({
        attributes: {
          title: null
        },
        relationships: {
          'primary-image': {
            data: {
              type: 'images',
              id: '100'
            }
          }
        }
      });
    });

    it('echos at creation', async function() {
      let record = await writers.create('master', env.session, 'articles', {
        type: 'articles',
        relationships: {
          'primary-image': {
            data: {
              type: 'images',
              id: '100'
            }
          }
        },
      });
      expect(record).to.have.deep.property('relationships.primary-image.data.id', '100');
      expect(record).to.have.deep.property('relationships.primary-image.data.type', 'images');
    });

    it('saves at update', async function() {
      await writers.update('master', env.session, 'articles', '1', {
        id: '1',
        type: 'articles',
        relationships: {
          'primary-image': {
            data: {
              type: 'images',
              id: '100'
            }
          }
        },
        meta: {
          version: head
        }
      });
      let saved = await inRepo(repoPath).getJSONContents('master', `contents/articles/1.json`);
      expect(saved).to.deep.equal({
        attributes: {
          title: 'First Article'
        },
        relationships: {
          'primary-image': {
            data: {
              type: 'images',
              id: '100'
            }
          }
        }
      });
    });

    it('echos at update', async function() {
      let record = await writers.update('master', env.session, 'articles', '1', {
        id: '1',
        type: 'articles',
        relationships: {
          'primary-image': {
            data: {
              type: 'images',
              id: '100'
            }
          }
        },
        meta: {
          version: head
        }
      });
      expect(record).to.have.deep.property('relationships.primary-image.data.id', '100');
      expect(record).to.have.deep.property('relationships.primary-image.data.type', 'images');
    });


  });



});
