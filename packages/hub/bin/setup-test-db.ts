#!/usr/bin/env node
const util = require('util');
const exec = util.promisify(require('child_process').exec);

process.env.NODE_ENV = 'test';
const config = require('config');
const dbConfig = config.get('db');

async function run() {
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
