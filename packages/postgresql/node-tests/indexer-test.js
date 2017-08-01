const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('@cardstack/test-support/env');
const { Client } = require('pg');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

describe('postgresql/indexer', function() {
  let pgClient, client, env;

  beforeEach(async function() {
    pgClient = new Client({ database: 'postgres' });
    await pgClient.connect();
    await pgClient.query(`create database test1`);

    client = new Client({ database: 'test1' });
    await client.connect();
    await client.query('create table articles (id varchar, title varchar)');
    await client.query('insert into articles values ($1, $2)', ['0', 'hello world']);

    let factory = new JSONAPIFactory();

    factory.addResource('plugin-configs').withAttributes({
      module: '@cardstack/git'
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


    env = await createDefaultEnvironment(`${__dirname}/..`);

    await env.lookup('hub:indexers').update({ realTime: true });
  });

  afterEach(async function() {
    await destroyDefaultEnvironment(env);
    await client.end();
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
  });


});
