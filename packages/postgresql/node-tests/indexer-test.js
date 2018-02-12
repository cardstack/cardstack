const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('@cardstack/test-support/env');
const { Client } = require('pg');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
const Session = require('@cardstack/plugin-utils/session');

describe('postgresql/indexer', function() {
  let pgClient, client, env, dataSource;

  async function setup() {
    pgClient = new Client({ database: 'postgres', host: 'localhost', user: 'postgres', port: 5444 });
    await pgClient.connect();
    await pgClient.query(`create database test1`);

    client = new Client({ database: 'test1', host: 'localhost', user: 'postgres', port: 5444 });
    await client.connect();
    await client.query('create table editors (id varchar primary key, name varchar)');
    await client.query('insert into editors values ($1, $2)', ['0', 'Some Editor']);
    await client.query('create table articles (id varchar primary key, title varchar, length integer, published boolean, topic varchar, editor varchar references editors(id))');
    await client.query('insert into articles values ($1, $2, $3, $4, $5, $6)', ['0', 'hello world', 100, true, null, '0']);
    await client.query('insert into articles values ($1, $2, $3, $4)', ['1', null, null, false]);

    let factory = new JSONAPIFactory();

    dataSource = factory.addResource('data-sources')
      .withAttributes({
        'source-type': '@cardstack/postgresql',
        params: {
          branches: {
            master: {
              host: 'localhost',
              user: 'postgres',
              database: 'test1',
              port: 5444
            }
          },
          renameTables: {
            editors: 'real-editors',
          },
          renameColumns: {
            articles: {
              topic: 'real-topic'
            }
          },
          patch: {
            'content-types': {
              'articles': [
                { op: "add", "path": "/attributes/default-includes", value: ["editor"] }
              ]
            }
          }
        }
      });


    env = await createDefaultEnvironment(`${__dirname}/..`, factory.getModels());

    await env.lookup('hub:indexers').update({ realTime: true });
  }

  async function teardown() {
    await destroyDefaultEnvironment(env);
    await client.end();
    await pgClient.query(`select pg_drop_replication_slot(slot_name) from pg_replication_slots;`);
    await pgClient.query(`drop database test1`);
    await pgClient.end();
  }

  describe('read-only tests', function() {
    before(setup);
    after(teardown);

    it('has a database', async function() {
      let result = await client.query('select title from articles where id=$1', ['0']);
      expect(result.rows).has.length(1);
      expect(result.rows[0].title).to.equal('hello world');
    });

    it('discovers content types', async function() {
      let doc = await env.lookup('hub:searchers').get(env.session, 'master', 'content-types', 'articles');
      expect(doc).is.ok;
      let model = doc.data;
      expect(model).is.ok;
      expect(model).has.deep.property('relationships.fields.data');
      expect(model.relationships.fields.data).collectionContains({ id: 'title' });
      expect(model.relationships.fields.data).not.collectionContains({ id: 'id' });
      expect(model.relationships['data-source'].data).has.property('id', dataSource.id);
    });

    it('discovers initial records', async function() {
      let doc = await env.lookup('hub:searchers').get(env.session, 'master', 'articles', '0');
      expect(doc).is.ok;
      let model = doc.data;
      expect(model).is.ok;
      expect(model).has.deep.property('attributes.title', 'hello world');
    });

    it('can read an integer column', async function() {
      let doc = await env.lookup('hub:searchers').get(env.session, 'master', 'articles', '0');
      expect(doc).is.ok;
      let model = doc.data;
      expect(model).has.deep.property('attributes.length', 100);
    });

    it('can read a boolean column', async function() {
      let doc = await env.lookup('hub:searchers').get(env.session, 'master', 'articles', '1');
      expect(doc).is.ok;
      let model = doc.data;
      expect(model).has.deep.property('attributes.published', false);
    });

    it('can read null string', async function() {
      let doc = await env.lookup('hub:searchers').get(env.session, 'master', 'articles', '1');
      expect(doc).is.ok;
      let model = doc.data;
      expect(model).has.deep.property('attributes.title', null);
    });

    it('can read null integer', async function() {
      let doc = await env.lookup('hub:searchers').get(env.session, 'master', 'articles', '1');
      expect(doc).is.ok;
      let model = doc.data;
      expect(model).has.deep.property('attributes.length', null);
    });

    it('can rename tables', async function() {
      let doc = await env.lookup('hub:searchers').get(env.session, 'master', 'content-types', 'real-editors');
      expect(doc).is.ok;
    });

    it('can rename columns', async function() {
      let doc = await env.lookup('hub:searchers').get(env.session, 'master', 'content-types', 'articles');
      expect(doc).is.ok;
      expect(doc.data.relationships.fields.data.map(f => f.id)).contains('real-topic');
    });


    it('can customize discovered schema', async function() {
      let doc = await env.lookup('hub:searchers').get(env.session, 'master', 'content-types', 'articles');
      expect(doc.data.attributes).has.property('default-includes');
      expect(doc.data.attributes['default-includes']).deep.equals(['editor']);
    });

    it('supports default includes', async function() {
      let doc = await env.lookup('hub:searchers').get(env.session, 'master', 'articles', '0');
      expect(doc).has.property('included');
      expect(doc.included).has.length(1);
      expect(doc.included[0]).has.deep.property('attributes.name', 'Some Editor');
    });

  });

  describe('read/write tests', function() {
    beforeEach(setup);
    afterEach(teardown);

    it('discovers new records', async function() {
      await client.query('insert into articles values ($1, $2)', ['2', 'second article']);
      await env.lookup('hub:indexers').update({ realTime: true });
      let doc = await env.lookup('hub:searchers').get(env.session, 'master', 'articles', '2');
      expect(doc).is.ok;
      let model = doc.data;
      expect(model).is.ok;
      expect(model).has.deep.property('attributes.title', 'second article');
    });


    it('updates records', async function() {
      await client.query('update articles set title=$1 where id=$2', ['I was updated', '0']);
      await env.lookup('hub:indexers').update({ realTime: true });
      let doc = await env.lookup('hub:searchers').get(env.session, 'master', 'articles', '0');
      expect(doc).is.ok;
      let model = doc.data;
      expect(model).is.ok;
      expect(model).has.deep.property('attributes.title', 'I was updated');
    });

    it('deletes records', async function() {
      await client.query('delete from articles where id=$1', ['0']);
      await env.lookup('hub:indexers').update({ realTime: true });
      try {
        await env.lookup('hub:searchers').get(env.session, 'master', 'articles', '0');
        throw new Error("should not get here");
      } catch (err) {
        expect(err.status).to.equal(404);
      }
    });

    it('discovers newly added content type', async function() {
      await client.query('create table humans (id varchar primary key, name varchar)');
      await env.lookup('hub:indexers').update({ realTime: true });
      let doc = await env.lookup('hub:searchers').get(env.session, 'master', 'content-types', 'humans');
      expect(doc).is.ok;
      let model = doc.data;
      expect(model).is.ok;
      expect(model).has.deep.property('relationships.fields.data');
      expect(model.relationships.fields.data).collectionContains({ id: 'name' });
    });

    it('removes deleted content type', async function() {
      await client.query('drop table articles');
      await env.lookup('hub:indexers').update({ realTime: true });
      try {
        await env.lookup('hub:searchers').get(env.session, 'master', 'content-types', 'articles');
        throw new Error("should not get here");
      } catch (err) {
        expect(err.status).to.equal(404);
      }
    });

    it('discovers newly added column', async function() {
      await client.query('alter table articles add column author varchar');
      await client.query('update articles set author=$1 where id=$2', ['Arthur', '0']);
      await env.lookup('hub:indexers').update({ realTime: true });
      let doc = await env.lookup('hub:searchers').get(env.session, 'master', 'content-types', 'articles');
      expect(doc).is.ok;
      let model = doc.data;
      expect(model).has.deep.property('relationships.fields.data');
      expect(model.relationships.fields.data).collectionContains({ id: 'author' });
      doc = await env.lookup('hub:searchers').get(env.session, 'master', 'articles', '0');
      expect(doc).has.deep.property('data.attributes.author', 'Arthur');
    });


  });
});
