const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('@cardstack/test-support/env');
const { Client } = require('pg');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

describe('postgresql/indexer', function() {
  let pgClient, client, env, dataSource;

  beforeEach(async function() {
    pgClient = new Client({ database: 'postgres' });
    await pgClient.connect();
    await pgClient.query(`create database test1`);

    client = new Client({ database: 'test1' });
    await client.connect();
    await client.query('create table articles (id varchar primary key, title varchar, length integer, published boolean)');
    await client.query('insert into articles values ($1, $2, $3, $4)', ['0', 'hello world', 100, true]);

    let factory = new JSONAPIFactory();

    factory.addResource('plugin-configs').withAttributes({
      module: '@cardstack/postgresql'
    });

    dataSource = factory.addResource('data-sources')
      .withAttributes({
        'source-type': '@cardstack/postgresql',
        params: {
          branches: {
            master: {
              database: 'test1'
            }
          }
        }
      });


    env = await createDefaultEnvironment(`${__dirname}/..`, factory.getModels());

    await env.lookup('hub:indexers').update({ realTime: true });
  });

  afterEach(async function() {
    await destroyDefaultEnvironment(env);
    await client.end();
    await pgClient.query(`select pg_drop_replication_slot(slot_name) from pg_replication_slots;`);
    await pgClient.query(`drop database test1`);
    await pgClient.end();
  });

  it('has a database', async function() {
    let result = await client.query('select title from articles where id=$1', ['0']);
    expect(result.rows).has.length(1);
    expect(result.rows[0].title).to.equal('hello world');
  });

  it('discovers content types', async function() {
    let model = await env.lookup('hub:searchers').get('master', 'content-types', 'articles');
    expect(model).is.ok;
    expect(model).has.deep.property('relationships.fields.data');
    expect(model.relationships.fields.data).collectionContains({ id: 'title' });
    expect(model.relationships.fields.data).not.collectionContains({ id: 'id' });
    expect(model.relationships['data-source'].data).has.property('id', dataSource.id);
  });

  it('discovers initial records', async function() {
    let model = await env.lookup('hub:searchers').get('master', 'articles', '0');
    expect(model).is.ok;
    expect(model).has.deep.property('attributes.title', 'hello world');
  });

  it('discovers new records', async function() {
    await client.query('insert into articles values ($1, $2)', ['1', 'second article']);
    await env.lookup('hub:indexers').update({ realTime: true });
    let model = await env.lookup('hub:searchers').get('master', 'articles', '1');
    expect(model).is.ok;
    expect(model).has.deep.property('attributes.title', 'second article');
  });


  it('updates records', async function() {
    await client.query('update articles set title=$1 where id=$2', ['I was updated', '0']);
    await env.lookup('hub:indexers').update({ realTime: true });
    let model = await env.lookup('hub:searchers').get('master', 'articles', '0');
    expect(model).is.ok;
    expect(model).has.deep.property('attributes.title', 'I was updated');
  });

  it('deletes records', async function() {
    await client.query('delete from articles where id=$1', ['0']);
    await env.lookup('hub:indexers').update({ realTime: true });
    try {
      await env.lookup('hub:searchers').get('master', 'articles', '0');
      throw new Error("should not get here");
    } catch (err) {
      expect(err.status).to.equal(404);
    }
  });

  it('discovers newly added content type', async function() {
    await client.query('create table humans (id varchar primary key, name varchar)');
    await env.lookup('hub:indexers').update({ realTime: true });
    let model = await env.lookup('hub:searchers').get('master', 'content-types', 'humans');
    expect(model).is.ok;
    expect(model).has.deep.property('relationships.fields.data');
    expect(model.relationships.fields.data).collectionContains({ id: 'name' });
  });

  it('removes deleted content type', async function() {
    await client.query('drop table articles');
    await env.lookup('hub:indexers').update({ realTime: true });
    try {
      await env.lookup('hub:searchers').get('master', 'content-types', 'articles');
      throw new Error("should not get here");
    } catch (err) {
      expect(err.status).to.equal(404);
    }
  });

  it('discovers newly added column', async function() {
    await client.query('alter table articles add column author varchar');
    await client.query('update articles set author=$1 where id=$2', ['Arthur', '0']);
    await env.lookup('hub:indexers').update({ realTime: true });
    let model = await env.lookup('hub:searchers').get('master', 'content-types', 'articles');
    expect(model).has.deep.property('relationships.fields.data');
    expect(model.relationships.fields.data).collectionContains({ id: 'author' });
    model = await env.lookup('hub:searchers').get('master', 'articles', '0');
    expect(model).has.deep.property('attributes.author', 'Arthur');
  });

  it('can read an integer column', async function() {
    let model = await env.lookup('hub:searchers').get('master', 'articles', '0');
    expect(model).has.deep.property('attributes.length', 100);
  });

  it('can read a boolean column', async function() {
    await client.query('insert into articles (id, published) values ($1, $2)', ['1', false]);
    await env.lookup('hub:indexers').update({ realTime: true });
    let model = await env.lookup('hub:searchers').get('master', 'articles', '1');
    expect(model).has.deep.property('attributes.published', false);
  });

  it('can read null string', async function() {
    await client.query('insert into articles (id) values ($1)', ['1']);
    await env.lookup('hub:indexers').update({ realTime: true });
    let model = await env.lookup('hub:searchers').get('master', 'articles', '1');
    expect(model).has.deep.property('attributes.title', null);
  });

  it('can read null integer', async function() {
    await client.query('insert into articles (id) values ($1)', ['1']);
    await env.lookup('hub:indexers').update({ realTime: true });
    let model = await env.lookup('hub:searchers').get('master', 'articles', '1');
    expect(model).has.deep.property('attributes.length', null);
  });


});
