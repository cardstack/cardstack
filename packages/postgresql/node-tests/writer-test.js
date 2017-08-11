const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('@cardstack/test-support/env');
const { Client } = require('pg');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

describe('postgresql/writer', function() {
  let pgClient, client, env, writer;

  beforeEach(async function() {
    pgClient = new Client({ database: 'postgres' });
    await pgClient.connect();
    await pgClient.query(`create database test1`);

    client = new Client({ database: 'test1' });
    await client.connect();
    await client.query('create sequence article_id_seq');
    await client.query(`create table articles (id varchar primary key DEFAULT cast(nextval('article_id_seq') as varchar), title varchar, length integer, published boolean)`);
    await client.query('insert into articles values ($1, $2, $3, $4)', ['0', 'hello world', 100, true]);

    let factory = new JSONAPIFactory();

    factory.addResource('plugin-configs').withAttributes({
      module: '@cardstack/postgresql'
    });

    factory.addResource('data-sources')
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
    writer = env.lookup('hub:writers');
  });

  afterEach(async function() {
    await destroyDefaultEnvironment(env);
    await client.end();
    await pgClient.query(`select pg_drop_replication_slot(slot_name) from pg_replication_slots;`);
    await pgClient.query(`drop database test1`);
    await pgClient.end();
  });

  it('can create new record', async function() {
    let created = await writer.create('master', env.session, 'articles', {
      type: 'articles',
      attributes: {
        title: 'I was created',
        length: 200,
        published: false
      }
    });
    let result = await client.query('select title, length, published from articles where id=$1', [created.id]);
    expect(result.rows).has.length(1);
    expect(result.rows[0].title).to.equal('I was created');
    expect(result.rows[0].length).to.equal(200);
    expect(result.rows[0].published).to.equal(false);
  });

  it('can create new record with user-provided id', async function() {
    let created = await writer.create('master', env.session, 'articles', {
      type: 'articles',
      id: '42',
      attributes: {
        title: 'I was created',
        length: 200,
        published: false
      }
    });
    expect(created.id).to.equal('42');
    let result = await client.query('select title, length, published from articles where id=$1', ['42']);
    expect(result.rows).has.length(1);
    expect(result.rows[0].title).to.equal('I was created');
    expect(result.rows[0].length).to.equal(200);
    expect(result.rows[0].published).to.equal(false);
  });

  it('can update a record', async function() {
    await writer.update('master', env.session, 'articles', '0', {
      type: 'articles',
      id: '0',
      attributes: {
        length: 101
      }
    });
    let result = await client.query('select title, length, published from articles where id=$1', ['0']);
    expect(result.rows).has.length(1);
    expect(result.rows[0].title).to.equal('hello world');
    expect(result.rows[0].length).to.equal(101);
  });

  it('returns full record from update', async function() {
    let updated = await writer.update('master', env.session, 'articles', '0', {
      type: 'articles',
      id: '0',
      attributes: {
        length: 101
      }
    });
    expect(updated).has.deep.property('attributes.length', 101);
    expect(updated).has.deep.property('attributes.title', 'hello world');
  });

});
