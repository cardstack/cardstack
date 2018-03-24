#!/usr/bin/env node

const { makeServer } = require('../main');
const commander = require('commander');
const path = require('path');
const fs = require('fs');
const logger = require('@cardstack/logger');
const log = logger('cardstack/server');

const seedsFolder = 'seeds';
const dataSourcesFolder = 'data-sources';

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

function commandLineOptions() {
  commander
    .usage(`

Cardstack Hub takes all its basic settings via environment variables:

CARDSTACK_SESSIONS_KEY  Required  A base64-encoded 32 byte random key for securing sessions. You can generate one using "yarn run cardstack-generate-key".
INITIAL_DATA_DIR        Required  The path to your initial data configuration directory.
ELASTICSEARCH                     The URL to our Elasticsearch instance. Defaults to http://localhost:9200
PORT                              Port to bind to. Defaults to 3000.
PUBLIC_HUB_URL                    The public URL at which the Hub can be accessed. Defaults to http://localhost:$PORT.
CI_SESSION_ID                     A session ID that has full priviledges which is used by CI for test setup and test tear down.
`)
    .parse(process.argv);

  if (!process.env.INITIAL_DATA_DIR) {
    process.stderr.write("You must set the INITIAL_DATA_DIR environment variable.\n");
    commander.outputHelp();
    process.exit(-1);
  }

  commander.initialDataDirectory = path.resolve(process.env.INITIAL_DATA_DIR);

  let base64Key = process.env.CARDSTACK_SESSIONS_KEY;
  let base64KeyPath = process.env.CARDSTACK_SESSIONS_KEY_FILE;
  if (base64Key) {
    commander.sessionsKey = new Buffer(base64Key, 'base64');
  } else if (base64KeyPath) {
    try {
      base64Key = fs.readFileSync(base64KeyPath, 'utf8');
    } catch (e) {
      process.stderr.write(`Could not read the file specified by CARDSTACK_SESSIONS_KEY_FILE (${base64KeyPath}).\n`);
      process.exit(1);
    }
    commander.sessionsKey = new Buffer(base64Key, 'base64');
  } else {
    process.stderr.write("You must set the CARDSTACK_SESSIONS_KEY environment variable.\n");
    commander.outputHelp();
    process.exit(-1);
  }

  // The ELASTICSEARCH env var is consumed directly
  // by @cardstack/elasticsearch/client, so we aren't putting it into
  // our return value here.

  if (process.env.PORT) {
    commander.port = parseInt(process.env.PORT, 10);
  } else {
    commander.port = 3000;
  }

  if (process.env.PUBLIC_HUB_URL) {
    commander.url = process.env.PUBLIC_HUB_URL;
  } else {
    commander.url = `http://localhost:${commander.port}`;
  }

  if (process.env.CI_SESSION_ID) {
    commander.ciSessionId = process.env.CI_SESSION_ID;
  }

  return commander;
}

function readDir(dir) {
  return fs.readdirSync(dir).map(filename => {
    if (/\.js$/.test(filename)) {
      return require(path.join(dir, filename));
    } else {
      return [];
    }
  }).reduce((a,b) => a.concat(b), []);
}

function loadModels(modelsDir) {
  try {
    let models = [];

    if (fs.existsSync(modelsDir) && fs.statSync(modelsDir).isDirectory()) {
      models = readDir(modelsDir);
    }

    return models;
  } catch (err) {
    process.stderr.write(`Unable to load models from the directory (${modelsDir}), ${err}\n`);
    process.exit(-1);
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

module.exports = {
  commandLineOptions,
  seedsFolder,
  loadModels,
  dataSourcesFolder
};
