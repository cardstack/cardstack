/* eslint-disable no-process-exit */

import { Argv } from 'yargs';
import { join } from 'path';
import config from 'dotenv';
import { createContainer } from '../../main';
import migrate from 'node-pg-migrate';

export let command = 'migrate';
export let describe = `Perform database migrations, specify direction 'up' or 'down' and optionally --no-check-order`;
export let builder = {};

export async function handler(_argv: Argv & { _: string[]; checkOrder?: boolean }) {
  let {
    _: [, , direction],
    checkOrder = true,
  } = _argv;

  if (direction == null) {
    direction = 'up';
  }

  if (direction! !== 'up' && direction! !== 'down') {
    throw new Error(`Invalid migration direction: '${direction}'. Must be 'up' or 'down'`);
  }

  config.config();
  let container = createContainer();
  let dbManager = await container.lookup('database-manager');
  let dbClient = await dbManager.getClient();
  let dir = join('.', 'dist', 'db', 'migrations');

  // Allow errors to bubble up so they're reported
  try {
    await migrate({
      direction,
      dir,
      migrationsTable: 'pgmigrations',
      count: direction === 'up' ? Infinity : 1,
      dbClient,
      checkOrder,
      verbose: true,
    });
  } finally {
    container.teardown();
  }
}
