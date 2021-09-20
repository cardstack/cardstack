#!/usr/bin/env node

/* eslint-disable node/shebang */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-require-imports */

//@ts-ignore not actually redefining block-scoped var
let container = require('./../main').bootEnvironment();
//@ts-ignore not actually redefining block-scoped var
let seed = require('./../db/seeds').default;
async function seedDatabase() {
  let dbManager = await container.lookup('database-manager');
  let db = await dbManager.getClient();
  console.log(`Seeding ${db.connectionParameters.database}...`);
  try {
    await seed(db);
    container.teardown();
  } catch (e) {
    console.error(e);
  }
}
seedDatabase();
