#!/usr/bin/env node

/* eslint-disable node/shebang */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-require-imports */
//@ts-ignore not actually redefining block-scoped var
const config = require('config');
//@ts-ignore not actually redefining block-scoped var
const util = require('util');
//@ts-ignore not actually redefining block-scoped var
const exec = util.promisify(require('child_process').exec);

//@ts-ignore not actually a duplicate function definition
// This script generates a structure.sql file that can be used to initialize the test database
// with all tables, indexes, foreign keys etc, as well as the content of the migrations tables
// The content of migrations tables is important to prevent graphile worker from trying to
// run migrations for a database that doesn't need them (will cause tests to fail)
async function performDump() {
  const dbConfig = config.get('db');
  await exec(`pg_dump --schema-only --file=config/structure.sql ${dbConfig.url}`);
  await exec(
    `pg_dump --data-only --table=pgmigrations --table=graphile_worker.migrations ${dbConfig.url} >> config/structure.sql`
  );

  console.log('Output to config/structure.sql');
}
performDump();
