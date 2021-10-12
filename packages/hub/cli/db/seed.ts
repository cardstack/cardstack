import config from 'dotenv';
import { createContainer } from '../../main';
import seed from '../../db/seeds';
import { Argv } from 'yargs';

export let command = 'seed';
export let describe = 'Seed the database from ./db/seeds';
export let builder = {};

export async function handler(_argv: Argv) {
  config.config();
  let container = createContainer();
  let dbManager = await container.lookup('database-manager');
  let db = await dbManager.getClient();
  console.log(`Seeding ${db.database}...`);
  try {
    await seed(db);
    container.teardown();
  } catch (e) {
    console.error(e);
  }
}
