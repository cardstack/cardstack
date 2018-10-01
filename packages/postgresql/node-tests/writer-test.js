const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('@cardstack/test-support/env');
const { Client } = require('pg');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
const supertest = require('supertest');
const Koa = require('koa');
const postgresConfig = require('@cardstack/plugin-utils/postgres-config');

describe('postgresql/writer', function() {
  let pgClient, client, env, writer, request, sessions;
  let dataSourceId = 'postgres';
  let ciSessionId = '1234567890';

  beforeEach(async function() {
    pgClient = new Client(postgresConfig());
    await pgClient.connect();
    await pgClient.query(`create database test1`);

    client = new Client(postgresConfig({ database: 'test1' }));
    await client.connect();
    await client.query('create sequence article_id_seq');
    await client.query(`create table articles (id varchar primary key DEFAULT cast(nextval('article_id_seq') as varchar), title varchar, length integer, published boolean, alt_topic varchar, multi_word varchar, less_than_ten integer, check (less_than_ten < 10))`);
    await client.query('insert into articles values ($1, $2, $3, $4)', ['0', 'hello world', 100, true]);

    await client.query('create table favorite_toys (id varchar primary key, name varchar)');
    await client.query('create table doggies (id varchar primary key, name varchar, favorite_toy varchar references favorite_toys(id))');

    let factory = new JSONAPIFactory();

    factory.addResource('data-sources', dataSourceId)
      .withAttributes({
        'source-type': '@cardstack/postgresql',
        params: {
          branches: {
            master: postgresConfig({ database: 'test1' })
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
        mayWriteFields: true,
        mayReadResource: true,
        mayReadFields: true
      }).withRelated('who', [factory.addResource('test-users', 'update-only')]);

    factory.addResource('grants')
      .withAttributes({
        mayCreateResource: true,
        mayUpdateResource: false,
        mayDeleteResource: false,
        mayWriteFields: true,
        mayReadResource: true,
        mayReadFields: true
      }).withRelated('who', [factory.addResource('test-users', 'create-only')]);

    factory.addResource('grants')
      .withAttributes({
        mayCreateResource: false,
        mayUpdateResource: false,
        mayDeleteResource: true,
        mayWriteFields: true,
        mayReadResource: true,
        mayReadFields: true
      }).withRelated('who', [factory.addResource('test-users', 'delete-only')]);


    env = await createDefaultEnvironment(`${__dirname}/../../../tests/postgres-test-app`, factory.getModels(), { ciSessionId });
    let app = new Koa();
    app.use(env.lookup('hub:middleware-stack').middleware());
    request = supertest(app.callback());

    await env.lookup('hub:indexers').update({ forceRefresh: true });
    writer = env.lookup('hub:writers');
    sessions = env.lookup('hub:sessions');
  });

  afterEach(async function() {
    await destroyDefaultEnvironment(env);
    if (client) {
      await client.end();
    }
    await pgClient.query(`select pg_drop_replication_slot(slot_name) from pg_replication_slots;`);
    await pgClient.query(`drop database test1`);
    await pgClient.end();
  });

  it('can create new record', async function() {
    let { data:created } = await writer.create('master', sessions.create('test-users', 'create-only'), 'articles', {
      data: {
        type: 'articles',
        attributes: {
          title: 'I was created',
          length: 200,
          published: false,
          topic: 'x',
          'multi-word': 'hello'
        }
      }
    });
    let result = await client.query('select title, length, published, alt_topic from articles where id=$1', [created.id]);
    expect(result.rows).has.length(1);
    expect(result.rows[0].title).to.equal('I was created');
    expect(result.rows[0].length).to.equal(200);
    expect(result.rows[0].alt_topic).to.equal('x');
    expect(result.rows[0].published).to.equal(false);

    await env.lookup('hub:indexers').update({ forceRefresh: true });

    let { body: { data } } = await request.get(`/api/articles/${created.id}`).set('Accept', 'application/vnd.api+json');
    expect(data).has.property('id', created.id);
    expect(data).has.property('type', 'articles');
    expect(data.attributes).to.deep.equal({
      "multi-word": "hello",
      "less-than-ten": null,
      "title": "I was created",
      "published": false,
      "length": 200,
      "topic": "x"
    });
  });

  it('reacts to database failure during create', async function() {
    try {
      await writer.create('master', sessions.create('test-users', 'create-only'), 'articles', {
        data: {
          type: 'articles',
          attributes: {
            title: 'I was created',
            length: 200,
            published: false,
            topic: 'x',
            'multi-word': 'hello',
            lessThanTen: 11
          }
        }
      });
      throw new Error("should not get here");
    } catch (err) {
      expect(err.status).to.equal(401);
      expect(err.title).to.equal('Constraint violation');
      expect(err.detail).to.match(/violates.*constraint/);
    }
    let result = await client.query('select title, length, published, alt_topic from articles where title=$1', ["I was created"]);
    expect(result.rows).has.length(0);
  });

  it('can create new record with user-provided id', async function() {
    let { data:created } = await writer.create('master', sessions.create('test-users', 'create-only'), 'articles', {
      data: {
        type: 'articles',
        id: '42',
        attributes: {
          title: 'I was created',
          length: 200,
          published: false
        }
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
    await writer.update('master', sessions.create('test-users', 'update-only'), 'articles', '0', {
      data: {
        type: 'articles',
        id: '0',
        attributes: {
          length: 101,
          topic: 'y'
        }
      }
    });
    let result = await client.query('select title, length, published, alt_topic from articles where id=$1', ['0']);
    expect(result.rows).has.length(1);
    expect(result.rows[0].title).to.equal('hello world');
    expect(result.rows[0].length).to.equal(101);
    expect(result.rows[0].alt_topic).to.equal('y');
  });

  it('handles attempt to update a non-existent record', async function() {
    try {
      await writer.update('master', sessions.create('test-users', 'update-only'), 'articles', '10', {
        data: {
          type: 'articles',
          id: '10',
          attributes: {
            length: 101,
            topic: 'y'
          }
        }
      });
      throw new Error("should not get here");
    } catch (err) {
      expect(err.status).to.equal(404);
    }
  });

  it('returns full record from update', async function() {
    let { data:updated } = await writer.update('master', sessions.create('test-users', 'update-only'), 'articles', '0', {
      data: {
        type: 'articles',
        id: '0',
        attributes: {
          length: 101
        }
      }
    });
    expect(updated).has.deep.property('attributes.length', 101);
    expect(updated).has.deep.property('attributes.title', 'hello world');
  });

  it('can delete a record', async function() {
    await writer.delete('master', sessions.create('test-users', 'delete-only'), null, 'articles', '0');
    let result = await client.query('select 1 from articles where id=$1', ['0']);
    expect(result.rows.length).to.equal(0);
  });

  it('can write a record that includes a relationship', async function() {
    let testFactory = new JSONAPIFactory();

    let squeakySnake = testFactory.addResource('favorite-toys').withAttributes({
      name: 'Squeaky Snake'
    });

    testFactory.addResource('doggies').withAttributes({
      name: "Van Gogh"
    }).withRelated('favorite-toy', squeakySnake);

    let [ snakeModel, dogModel ] = testFactory.getModels();

    await writer.create('master', sessions.create('test-users', 'create-only'), snakeModel.type, { data: snakeModel });
    await writer.create('master', sessions.create('test-users', 'create-only'), dogModel.type, { data: dogModel });

    let { rows } = await client.query('select name, favorite_toy from doggies where id=$1', [dogModel.id]);
    let [ result ] = rows;

    expect(result.name).to.equal("Van Gogh");
    expect(result.favorite_toy).to.equal(snakeModel.id);
  });
});
