import { Argv } from 'yargs';
import util from 'util';
import childProcess from 'child_process';
const exec = util.promisify(childProcess.exec);
import config from 'config';

export let command = 'dump';
export let describe = 'Dump a structure.sql file to be used to init the test database';
// This script generates a structure.sql file that can be used to initialize the test database
// with all tables, indexes, foreign keys etc, as well as the content of the migrations tables
// The content of migrations tables is important to prevent graphile worker from trying to
// run migrations for a database that doesn't need them (will cause tests to fail)

export let builder = {};

export async function handler(_argv?: Argv) {
  const dbConfig = config.get<any>('db');
  await exec(`pg_dump --schema-only --file=config/structure.sql ${dbConfig.url}`);
  await exec(
    `pg_dump --data-only --table=pgmigrations --table=graphile_worker.migrations ${dbConfig.url} >> config/structure.sql`
  );

  console.log('Output to config/structure.sql');
}
