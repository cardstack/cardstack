/* eslint-disable no-process-exit */

import { Argv } from 'yargs';
import { join } from 'path';
import config from 'dotenv';
import { createContainer } from '../../main';

export let command = 'migrate';
export let describe = `Perform database migrations, specify direction 'up' or 'down' and optionally --no-check-order`;
export let builder = {};

export async function handler(_argv: Argv & { _: string[]; checkOrder?: boolean }) {
  const migrateModule = join(process.cwd(), 'dist', 'node-pg-migrate');
  const { default: migrate } = __non_webpack_require__(migrateModule);

  let {
    _: [, , direction],
    checkOrder = true,
  } = _argv;
  if (direction! !== 'up' && direction! !== 'down') {
    console.error(`Invalid migration direction: '${direction}'. Must be 'up' or 'down'`);
    process.exit(1);
  }
  config.config();
  let container = createContainer();
  let dbManager = await container.lookup('database-manager');
  let dbClient = await dbManager.getClient();
  let dir = join('.', 'dist', 'db', 'migrations');

  try {
    await migrate({
      direction,
      dir,
      migrationsTable: 'pgmigrations',
      count: Infinity,
      dbClient,
      checkOrder,
    });
    container.teardown();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
