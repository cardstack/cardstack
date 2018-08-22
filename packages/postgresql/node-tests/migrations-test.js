const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('@cardstack/test-support/env');
const { Client } = require('pg');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
const postgresConfig = require('@cardstack/plugin-utils/postgres-config');

describe('postgresql/migrations', function() {
  let pgClient, env;

  async function setup(migrationScenario) {
    let factory = new JSONAPIFactory();
    factory.addResource('data-sources')
      .withAttributes({
        'source-type': '@cardstack/postgresql',
        params: {
          branches: {
            master: Object.assign(postgresConfig({ database: 'test1' }), {
              migrationsDir: migrationScenario ? `node-tests/migrations/${migrationScenario}` : null
            })
          }
        }
      });
    return createDefaultEnvironment(`${__dirname}/..`, factory.getModels());
  }

  beforeEach(async function() {
    pgClient = new Client(postgresConfig());
    await pgClient.connect();
    await pgClient.query(`create database test1`);
  });

  afterEach(async function() {
    await destroyDefaultEnvironment(env);
    await pgClient.query(`select pg_drop_replication_slot(slot_name) from pg_replication_slots;`);
    await pgClient.query(`drop database test1`);
    await pgClient.end();
  });

  it('can run a simple migration', async function() {
    env = await setup('good-scenario');
    let type = await env.lookup('hub:searchers').get(env.session, 'master', 'content-types', 'posts');
    expect(type).has.deep.property('data.relationships.fields.data');
    expect(type.data.relationships.fields.data).collectionContains({ id: 'title'});
  });

  it('migrations are idempotent', async function() {
    env = await setup('good-scenario');
    await env.lookup('hub:searchers').get(env.session, 'master', 'content-types', 'posts');
    await destroyDefaultEnvironment(env);
    await pgClient.query(`select pg_drop_replication_slot(slot_name) from pg_replication_slots;`);
    env = await setup('good-scenario');
    let type = await env.lookup('hub:searchers').get(env.session, 'master', 'content-types', 'posts');
    expect(type).has.deep.property('data.relationships.fields.data');
    expect(type.data.relationships.fields.data).collectionContains({ id: 'title'});
  });

  it('throws during initialization and rolls back if migration fails ', async function() {
    try {
      await setup('bad-scenario');
      throw new Error("should not get here");
    } catch (err) {
      expect(err.message).to.match(/not_a_real_table/);
    }

    env = await setup();

    try {
      await env.lookup('hub:searchers').get(env.session, 'master', 'content-types', 'comments');
      throw new Error("earlier statements in the failing migration were not rolled back");
    } catch (err) {
      expect(err.message).to.match(/No such resource master\/content-types\/comments/);
    }


    try {
      await env.lookup('hub:searchers').get(env.session, 'master', 'content-types', 'posts');
      throw new Error("other concurrent migrations were not rolled back");
    } catch (err) {
      expect(err.message).to.match(/No such resource master\/content-types\/posts/);
    }
  });

});
