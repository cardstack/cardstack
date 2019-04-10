const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('@cardstack/test-support/env');
const { Client } = require('pg');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
const postgresConfig = require('@cardstack/plugin-utils/postgres-config');

describe('postgresql/indexer', function() {
  let pgClient, client, env, dataSource;

  async function setup() {
    pgClient = new Client(postgresConfig());
    await pgClient.connect();
    await pgClient.query(`create database test1`);

    client = new Client(postgresConfig({ database: 'test1' }));
    await client.connect();
    await client.query('create table editors (id varchar primary key, name varchar)');
    await client.query('insert into editors values ($1, $2)', ['0', 'Some Editor']);
    await client.query('create table articles (id varchar primary key, title varchar, length integer, published boolean, topic varchar, editor varchar references editors(id))');
    await client.query('insert into articles values ($1, $2, $3, $4, $5, $6)', ['0', 'hello world', 100, true, null, '0']);
    await client.query('insert into articles values ($1, $2, $3, $4)', ['1', null, null, false]);

    await client.query('create table favorite_toys (id varchar primary key, toy_name varchar)');
    await client.query('insert into favorite_toys values ($1, $2)', ['0', 'Squeaky Snake']);
    await client.query('create table doggies (id varchar primary key, name varchar, favorite_toy varchar references favorite_toys(id))');
    await client.query('insert into doggies values ($1, $2, $3)', ['0', 'Van Gogh', '0']);

    await client.query('create table grades (id varchar primary key)');
    await client.query('insert into grades values ($1)', ['A']);
    await client.query('create table report_cards (id varchar primary key, history_grade varchar references grades(id))');
    await client.query('insert into report_cards values ($1, $2)', ['0', 'A']);



    let factory = new JSONAPIFactory();

    dataSource = factory.addResource('data-sources')
      .withAttributes({
        'source-type': '@cardstack/postgresql',
        params: {
          branches: {
            master: postgresConfig({ database: 'test1'})
          },
          renameTables: {
            editors: 'real-editors',
          },
          renameColumns: {
            articles: {
              topic: 'real-topic'
            }
          },
          typeHints: {
            favorite_toys: {
              toy_name: '@cardstack/core-types::case-insensitive'
            },
            report_cards: {
              history_grade: '@cardstack/core-types::string'
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

    await env.lookup('hub:indexers').update({ forceRefresh: true });
  }

  async function teardown() {
    await destroyDefaultEnvironment(env);
    if (client) {
      await client.end();
    }
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
      let doc = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'content-types', 'articles');
      expect(doc).is.ok;
      let model = doc.data;
      expect(model).is.ok;
      expect(model).has.deep.property('relationships.fields.data');
      expect(model.relationships.fields.data).collectionContains({ id: 'title' });
      expect(model.relationships.fields.data).not.collectionContains({ id: 'id' });
      expect(model.relationships['data-source'].data).has.property('id', dataSource.id);
    });

    it('handles relationships with underscored names', async function() {
      let doc = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'content-types', 'doggies');
      expect(doc).is.ok;
      let model = doc.data;

      expect(model).is.ok;
      expect(model).has.deep.property('relationships.fields.data');
      expect(model.relationships.fields.data).collectionContains({ id: 'favorite-toy' });
      expect(model.relationships.fields.data).not.collectionContains({ id: 'id' });
      expect(model.relationships['data-source'].data).has.property('id', dataSource.id);
    });

    it('discovers initial records', async function() {
      let doc = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'articles', '0');
      expect(doc).is.ok;
      let model = doc.data;
      expect(model).is.ok;
      expect(model).has.deep.property('attributes.title', 'hello world');
    });

    it('can read an integer column', async function() {
      let doc = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'articles', '0');
      expect(doc).is.ok;
      let model = doc.data;
      expect(model).has.deep.property('attributes.length', 100);
    });

    it('can read a boolean column', async function() {
      let doc = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'articles', '1');
      expect(doc).is.ok;
      let model = doc.data;
      expect(model).has.deep.property('attributes.published', false);
    });

    it('can read null string', async function() {
      let doc = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'articles', '1');
      expect(doc).is.ok;
      let model = doc.data;
      expect(model).has.deep.property('attributes.title', null);
    });

    it('can read null integer', async function() {
      let doc = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'articles', '1');
      expect(doc).is.ok;
      let model = doc.data;
      expect(model).has.deep.property('attributes.length', null);
    });

    it('can rename tables', async function() {
      let doc = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'content-types', 'real-editors');
      expect(doc).is.ok;
    });

    it('can rename columns', async function() {
      let doc = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'content-types', 'articles');
      expect(doc).is.ok;
      expect(doc.data.relationships.fields.data.map(f => f.id)).contains('real-topic');
    });

    it('can use type hints', async function() {
      let response = await env.lookup('hub:searchers').search(env.session, { filter: { 'toy-name': { exact: 'SQueAkY sNakE' } } });
      expect(response.data).length(1);
      expect(response.data[0].attributes['toy-name']).to.equal('Squeaky Snake');
    });

    it('can customize discovered schema', async function() {
      let doc = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'content-types', 'articles');
      expect(doc.data.attributes).has.property('default-includes');
      expect(doc.data.attributes['default-includes']).deep.equals(['editor']);
    });

    it('supports default includes', async function() {
      let doc = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'articles', '0');
      expect(doc).has.property('included');
      expect(doc.included).has.length(1);
      expect(doc.included[0]).has.deep.property('attributes.name', 'Some Editor');
    });

    it('can use type hints to make a relationship into an attribute', async function() {
      let doc = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'report-cards', '0');
      expect(doc.data.attributes).has.property('history-grade', 'A');
    });

  });

  describe('read/write tests', function() {
    beforeEach(setup);
    afterEach(teardown);

    it('discovers new records', async function() {
      await client.query('insert into articles values ($1, $2)', ['2', 'second article']);
      await env.lookup('hub:indexers').update({ forceRefresh: true });
      let doc = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'articles', '2');
      expect(doc).is.ok;
      let model = doc.data;
      expect(model).is.ok;
      expect(model).has.deep.property('attributes.title', 'second article');
    });


    it('updates records', async function() {
      await client.query('update articles set title=$1 where id=$2', ['I was updated', '0']);
      await env.lookup('hub:indexers').update({ forceRefresh: true });
      let doc = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'articles', '0');
      expect(doc).is.ok;
      let model = doc.data;
      expect(model).is.ok;
      expect(model).has.deep.property('attributes.title', 'I was updated');
    });

    it('deletes records', async function() {
      await client.query('delete from articles where id=$1', ['0']);
      await env.lookup('hub:indexers').update({ forceRefresh: true });
      try {
        await env.lookup('hub:searchers').get(env.session, 'local-hub', 'articles', '0');
        throw new Error("should not get here");
      } catch (err) {
        expect(err.status).to.equal(404);
      }
    });

    it('discovers newly added content type', async function() {
      await client.query('create table humans (id varchar primary key, name varchar)');
      await env.lookup('hub:indexers').update({ forceRefresh: true });
      let doc = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'content-types', 'humans');
      expect(doc).is.ok;
      let model = doc.data;
      expect(model).is.ok;
      expect(model).has.deep.property('relationships.fields.data');
      expect(model.relationships.fields.data).collectionContains({ id: 'name' });
    });

    it('removes deleted content type', async function() {
      await client.query('drop table articles');
      await env.lookup('hub:indexers').update({ forceRefresh: true });
      try {
        await env.lookup('hub:searchers').get(env.session, 'local-hub', 'content-types', 'articles');
        throw new Error("should not get here");
      } catch (err) {
        expect(err.status).to.equal(404);
      }
    });

    it('discovers newly added column', async function() {
      await client.query('alter table articles add column author varchar');
      await client.query('update articles set author=$1 where id=$2', ['Arthur', '0']);
      await env.lookup('hub:indexers').update({ forceRefresh: true });
      let doc = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'content-types', 'articles');
      expect(doc).is.ok;
      let model = doc.data;
      expect(model).has.deep.property('relationships.fields.data');
      expect(model.relationships.fields.data).collectionContains({ id: 'author' });
      doc = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'articles', '0');
      expect(doc).has.deep.property('data.attributes.author', 'Arthur');
    });

    it('cleans up abandoned replication slots', async function() {
      await env.lookup('hub:indexers').update({ forceRefresh: true });
      let result = await client.query('SELECT * FROM pg_replication_slots');
      let [ { slot_name: abandonedSlot } ] = result.rows;

      // deleting the index will cause the replication slot to be abandoned
      let pgSearchClient = env.lookup(`plugin-client:${require.resolve('@cardstack/pgsearch/client')}`);
      await pgSearchClient.query('delete from meta where id=$1', [dataSource.id]);
      await env.lookup('hub:indexers').update({ forceRefresh: true });

      result = await client.query('SELECT * FROM pg_replication_slots');
      expect(result.rows.length).to.equal(1); // currently test DB is configured to fire an error if more than 1 slot created, but including this test in case that is ever changed

      let [ { slot_name: currentSlot } ] = result.rows;
      expect(currentSlot).to.not.equal(abandonedSlot);
    });

  });
});
