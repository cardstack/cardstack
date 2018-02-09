const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('@cardstack/test-support/env');
const { Client } = require('pg');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
const Session = require('@cardstack/plugin-utils/session');

describe('postgresql/writer', function() {
  let pgClient, client, env, writer;

  beforeEach(async function() {
    pgClient = new Client({ database: 'postgres', host: 'localhost', user: 'postgres', port: 5444 });
    await pgClient.connect();
    await pgClient.query(`create database test1`);

    client = new Client({ database: 'test1', host: 'localhost', user: 'postgres', port: 5444 });
    await client.connect();
    await client.query('create sequence article_id_seq');
    await client.query(`create table articles (id varchar primary key DEFAULT cast(nextval('article_id_seq') as varchar), title varchar, length integer, published boolean, alt_topic varchar)`);
    await client.query('insert into articles values ($1, $2, $3, $4)', ['0', 'hello world', 100, true]);

    let factory = new JSONAPIFactory();

    factory.addResource('data-sources')
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
          renameColumns: {
            articles: {
              alt_topic: 'topic'
            }
          }
        }
      });

    // I'm creating some restrictive grants here to ensure that the
    // operations we think we're getting are really the ones we're
    // getting. (It's currently possible for a writer implementation
    // to mess these up by constructing the PendingChange wrong --
    // that needs to get fixed by refactoring, but for now we have
    // coverage.)

    factory.addResource('grants')
      .withAttributes({
        mayCreateResource: false,
        mayUpdateResource: true,
        mayDeleteResource: false,
        mayWriteFields: true
      }).withRelated('who', factory.addResource('groups', 'update-only'));

    factory.addResource('grants')
      .withAttributes({
        mayCreateResource: true,
        mayUpdateResource: false,
        mayDeleteResource: false,
        mayWriteFields: true
      }).withRelated('who', factory.addResource('groups', 'create-only'));

    factory.addResource('grants')
      .withAttributes({
        mayCreateResource: false,
        mayUpdateResource: false,
        mayDeleteResource: true,
        mayWriteFields: true
      }).withRelated('who', factory.addResource('groups', 'delete-only'));


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
    let created = await writer.create('master', new Session({ id: 'create-only', type: 'users'}), 'articles', {
      type: 'articles',
      attributes: {
        title: 'I was created',
        length: 200,
        published: false,
        topic: 'x'
      }
    });
    let result = await client.query('select title, length, published, alt_topic from articles where id=$1', [created.id]);
    expect(result.rows).has.length(1);
    expect(result.rows[0].title).to.equal('I was created');
    expect(result.rows[0].length).to.equal(200);
    expect(result.rows[0].alt_topic).to.equal('x');
    expect(result.rows[0].published).to.equal(false);
  });

  it('can create new record with user-provided id', async function() {
    let created = await writer.create('master', new Session({ id: 'create-only', type: 'users'}), 'articles', {
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
    await writer.update('master', new Session({ id: 'update-only', type: 'users'}), 'articles', '0', {
      type: 'articles',
      id: '0',
      attributes: {
        length: 101,
        topic: 'y'
      }
    });
    let result = await client.query('select title, length, published, alt_topic from articles where id=$1', ['0']);
    expect(result.rows).has.length(1);
    expect(result.rows[0].title).to.equal('hello world');
    expect(result.rows[0].length).to.equal(101);
    expect(result.rows[0].alt_topic).to.equal('y');
  });

  it('returns full record from update', async function() {
    let updated = await writer.update('master', new Session({ id: 'update-only', type: 'users'}), 'articles', '0', {
      type: 'articles',
      id: '0',
      attributes: {
        length: 101
      }
    });
    expect(updated).has.deep.property('attributes.length', 101);
    expect(updated).has.deep.property('attributes.title', 'hello world');
  });

  it('can delete a record', async function() {
    await writer.delete('master', new Session({ id: 'delete-only', type: 'users'}), null, 'articles', '0');
    let result = await client.query('select 1 from articles where id=$1', ['0']);
    expect(result.rows.length).to.equal(0);
  });

});
