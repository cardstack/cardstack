import { Argv } from 'yargs';
import migrate from 'node-pg-migrate';
import { join } from 'path';
import config from 'dotenv';
import { createContainer } from '../../main';

export let command = 'migrate';
export let describe = 'Perform database migrations';
export let builder = {};

export async function handler(_argv: Argv & { _: string[] }) {
  let {
    _: [, , direction, ...args],
  } = _argv;
  if (direction! !== 'up' && direction! !== 'down') {
    console.error(`Invalid migration direction: '${direction}'. Must be 'up' or 'down'`);
    process.exit(1);
  }
  config.config();
  let container = createContainer();
  let dbManager = await container.lookup('database-manager');
  let dbClient = await dbManager.getClient();
  let dir = join('.', 'dist', 'migrations');
  let checkOrder = args?.includes('--no-check-order') ? false : true;

  try {
    let migrations = await migrate({
      direction,
      dir,
      migrationsTable: 'pgmigrations',
      count: Infinity,
      dbClient,
      checkOrder,
    });
    console.log(JSON.stringify(migrations, null, 2));
    container.teardown();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
