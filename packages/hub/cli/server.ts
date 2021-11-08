/* eslint-disable no-process-exit */

import logger from '@cardstack/logger';
import nodeCleanup from 'node-cleanup';
import { Argv, Options } from 'yargs';
import { createContainer, HubServer } from '../main';
import { serverLog } from '../utils/logger';

export let command = 'serve';
export let aliases = 'server';
export let describe = 'Boot the server';

export function builder(yargs: Argv) {
  let options: { [key: string]: Options } = {
    port: {
      alias: 'p',
      describe: 'The port to server should listen on',
      type: 'number',
      nargs: 1,
      default: 3000,
    },
  };
  if (process.env.COMPILER) {
    options['noWatch'] = {
      alias: 'nw',
      describe: 'Disable watching for changes to cards',
      type: 'boolean',
      default: false,
      nargs: 1,
    };
  }
  return yargs.options(options);
}

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
  let container = createContainer();
  let server: HubServer;
  try {
    server = await container.lookup('hubServer');
  } catch (err: any) {
    serverLog.error('Server failed to start cleanly: %s', err.stack || err);
    process.exit(-1);
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

  nodeCleanup((_exitCode, signal) => {
    container.teardown().then(() => {
      process.kill(process.pid, signal as string);
    });
    nodeCleanup.uninstall(); // don't call cleanup handler again
    return false;
  });

  if (process.env.COMPILER) {
    await server.primeCache();

    if (!argv.noWatch) {
      await server.watchCards();
    }
  }

  return server.listen(argv.port);
}
