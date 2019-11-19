#!/usr/bin/env node

/* eslint-disable no-process-exit */
/* eslint-disable node/shebang */

import logger from '@cardstack/logger';
import { makeServer } from '../main';
const log = logger('cardstack/server');

if (process.env.EMBER_ENV === 'test') {
  logger.configure({
    defaultLevel: 'warn'
  });
} else {
  logger.configure({
    defaultLevel: 'warn',
    logLevels: [['cardstack/*', 'info']]
  });
}


export interface StartupConfig {
  port: number;
}

function startupConfig(): StartupConfig {
  let config: StartupConfig = {
    port: 3000
  };
  if (process.env.PORT) {
    config.port = parseInt(process.env.PORT, 10);
  }
  return config;
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
  log.info(`Shutting down because connected parent process has already exited.`);
  process.exit(0);
}
process.on('disconnect', () => {
  log.info(`Hub shutting down because connected parent process exited.`);
  process.exit(0);
});

async function runServer(config: StartupConfig) {
  let app = await makeServer();
  app.listen(config.port);
  log.info("server listening on %s", config.port);
  if (process.connected) {
    process.send!('hub hello');
  }
}

runServer(startupConfig()).catch((err: Error) => {
  log.error("Server failed to start cleanly: %s", err.stack || err);
  process.exit(-1);
});
