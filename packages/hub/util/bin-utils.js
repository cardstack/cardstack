/* eslint-disable no-process-exit */

const commander = require('commander');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const testingToken = require('crypto').randomBytes(32).toString('base64').replace(/\W+/g, '');
const seedsFolder = 'seeds';
const dataSourcesFolder = 'data-sources';

function commandLineOptions() {
  commander
    .usage(`

Cardstack Hub takes all its basic settings via environment variables:

CARDSTACK_SESSIONS_KEY  Required  A base64-encoded 32 byte random key for securing sessions. You can generate one using "yarn run cardstack-generate-key".
INITIAL_DATA_DIR        Required  The path to your initial data configuration directory.
ELASTICSEARCH                     The URL to our Elasticsearch instance. Defaults to http://localhost:9200
PORT                              Port to bind to. Defaults to 3000.
PUBLIC_HUB_URL                    The public URL at which the Hub can be accessed. Defaults to http://localhost:$PORT.
ENABLE_TEST_SESSION               When set to a non-falsy value, this indicates if a priviledged session should be shared with the client for the purpose of test setup/tear down. Note that this is automatically enabled in the test environment.
HUB_ENVIRONMENT                   The environment the hub is running in. Possible values are "development", "production", and "test". Defaults to "development".
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
    commander.sessionsKey = Buffer.from(base64Key, 'base64');
  } else if (base64KeyPath) {
    try {
      base64Key = fs.readFileSync(base64KeyPath, 'utf8');
    } catch (e) {
      process.stderr.write(`Could not read the file specified by CARDSTACK_SESSIONS_KEY_FILE (${base64KeyPath}).\n`);
      process.exit(1);
    }
    commander.sessionsKey = Buffer.from(base64Key, 'base64');
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

  if (Boolean(process.env.ENABLE_TEST_SESSION) || process.env.HUB_ENVIRONMENT === 'test') {
    commander.ciSessionId = testingToken;
  }

  commander.environment = process.env.HUB_ENVIRONMENT || "development";

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

module.exports = {
  commandLineOptions,
  seedsFolder,
  loadModels,
  dataSourcesFolder
};
