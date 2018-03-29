#!/usr/bin/env node

/* eslint-disable no-process-exit */

const { makeServer } = require('../main');
const path = require('path');
const { commandLineOptions,
        loadModels,
        seedsFolder,
        dataSourcesFolder } = require('../util/bin-utils');
const logger = require('@cardstack/logger');
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

async function runServer(options, dataSources) {
  let {
    sessionsKey,
    port,
  } = options;

  let seedsDir = path.join(options.initialDataDirectory, seedsFolder);
  options.seeds = () => loadModels(seedsDir);

  let app = await makeServer(process.cwd(), sessionsKey, dataSources, options);
  app.listen(port);
  log.info("server listening on %s", port);
  if (process.connected) {
    process.send('hub hello');
  }
}

process.on('warning', (warning) => {
  process.stderr.write(warning.stack);
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


let options = commandLineOptions();
let dataSources = loadModels(path.join(options.initialDataDirectory, dataSourcesFolder));
runServer(options, dataSources).catch(err => {
  log.error("Server failed to start cleanly: %s", err.stack || err);
  process.exit(-1);
});
