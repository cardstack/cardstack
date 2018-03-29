#!/usr/bin/env node

/* eslint-disable no-process-exit */

const path = require('path');
const { commandLineOptions,
        loadModels,
        seedsFolder,
        dataSourcesFolder } = require('../util/bin-utils');
const { wireItUp, loadSeeds } = require('../main');
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

async function setupContainer(options, dataSources) {
  let { sessionsKey } = options;

  options.seeds = () => loadSeedModels(options);
  options.disableAutomaticIndexing = true;

  return await wireItUp(process.cwd(), sessionsKey, dataSources, options);
}

function loadSeedModels(options) {
  return loadModels(path.join(options.initialDataDirectory, seedsFolder));
}

let options = commandLineOptions();
let dataSources = loadModels(path.join(options.initialDataDirectory, dataSourcesFolder));

setupContainer(options, dataSources).then(container => {
  let seedModels = loadSeedModels(options);
  log.info(`loading ${seedModels.length} seed models`);
  log.debug(`loading seeds:\n${JSON.stringify(seedModels.null, 2)}`);

  return loadSeeds(container, seedModels);
}).then(() => {
  log.info("Completed loading seed models");
  process.exit(0);
}).catch(err => {
  log.error("Failed to load seed models: %s", err.stack || err);
  process.exit(-1);
});
