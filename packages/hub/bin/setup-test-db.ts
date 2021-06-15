#!/usr/bin/env node

/* eslint-disable node/shebang */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-require-imports */
const util = require('util');
//@ts-ignore not actually redefining block-scoped var
const exec = util.promisify(require('child_process').exec);

process.env.NODE_ENV = 'test';
//@ts-ignore not actually redefining block-scoped var
const config = require('config');

//@ts-ignore not actually a duplicate function definition
async function run() {
  const dbConfig = config.get('db');
  try {
    console.log('Dropping hub_test db...');
    let result = await exec(`dropdb hub_test`);
    console.log(result);
  } catch (e) {
    // ok if this fails
  }
  console.log('Creating new hub_test db...');
  let result = await exec(`createdb hub_test`);
  console.log(result);

  console.log('Loading structure.sql into new hub_test db...');
  result = await exec(`psql ${dbConfig.url} < config/structure.sql`);
  console.log(result);
}
run();
