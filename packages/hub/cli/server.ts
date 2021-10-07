/* eslint-disable no-process-exit */

import logger from '@cardstack/logger';
import { Argv } from 'yargs';
import { HubServer, SERVER_CONFIG_DEFAULTS } from '../main';

const serverLog = logger('hub/server');

export let command = 'serve';
export let aliases = 'server';
export let describe = 'Boot the server';

export let builder = function (yargs: Argv) {
  return yargs.options({
    port: {
      alias: 'p',
      describe: 'The port to server should listen on',
      type: 'number',
      nargs: 1,
      default: SERVER_CONFIG_DEFAULTS.port,
    },
    noWatch: {
      alias: 'nw',
      describe: 'Disable watching for changes to cards',
      type: 'boolean',
      default: SERVER_CONFIG_DEFAULTS.noWatch,
      nargs: 1,
    },
  });
};

// Using any right now because I dont know how to get the generated
// type from the above handler into this handler
export async function handler(argv: any) {
  if (process.env.EMBER_ENV === 'test') {
    logger.configure({
      defaultLevel: 'warn',
    });
  } else {
    logger.configure({
      defaultLevel: 'warn',
      logLevels: [['hub/*', 'info']],
    });
  }

  process.on('warning', (warning: Error) => {
    if (warning.stack) {
      process.stderr.write(warning.stack);
    }
  });

  if (process.connected === false) {
    // This happens if we were started by another node process with IPC
    // and that parent has already died by the time we got here.
    //
    // (If we weren't started under IPC, `process.connected` is
    // undefined, so this never happens.)
    serverLog.info(`Shutting down because connected parent process has already exited.`);
    process.exit(0);
  }

  process.on('disconnect', () => {
    serverLog.info(`Hub shutting down because connected parent process exited.`);
    process.exit(0);
  });

  return (
    await HubServer.create({ port: argv.port }).catch((err: Error) => {
      serverLog.error('Server failed to start cleanly: %s', err.stack || err);
      process.exit(-1);
    })
  ).listen();
}
