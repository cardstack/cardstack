#!/usr/bin/env node

/* eslint-disable node/shebang */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-require-imports */

//@ts-ignore not actually redefining block-scoped var
const esmRequire = require('esm')(module, { cjs: true });
//@ts-ignore not actually redefining block-scoped var
let container = esmRequire('./../main').bootEnvironment();
//@ts-ignore not actually redefining block-scoped var
let seed = esmRequire('./../db/seeds').default;
async function seedDatabase() {
  let dbManager = await container.lookup('database-manager');
  let db = await dbManager.getClient();
  console.log(`Seeding ${db.connectionParameters.database}...`);
  try {
    db.connect();
    await seed(db);
    db.end();
  } catch (e) {
    console.error(e);
  }
}
seedDatabase();
