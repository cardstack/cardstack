#!/usr/bin/env node

/* eslint-disable node/shebang */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-require-imports */
//@ts-ignore not actually redefining block-scoped var
const config = require('config');
//@ts-ignore not actually redefining block-scoped var
const { exec } = require('child_process');

//@ts-ignore not actually a duplicate function definition
async function run() {
  const dbConfig = config.get('db');
  await exec(`pg_dump -s ${dbConfig.url} -f config/structure.sql`);
  console.log('Output to config/structure.sql');
}
run();
