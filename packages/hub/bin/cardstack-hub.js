#!/usr/bin/env node

const { makeServer } = require('../main');
const commander = require('commander');
const path = require('path');
const fs = require('fs');
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

async function runServer(options, seedModels) {
  let {
    sessionsKey,
    port,
  } = options;
  let app = await makeServer(process.cwd(), sessionsKey, seedModels, options);
  app.listen(port);
  log.info("server listening on %s", port);
  if (process.connected) {
    process.send('hub hello');
  }
}

function commandLineOptions() {
  commander
    .usage('[options] <seed-config-directory>')
    .option('-p --port <port>', 'Server listen port', 3000)
    .option('-u --url <url>', "Server's public base URL. Defaults to http://localhost:$PORT.")
    .option('-c --containerized', 'Run the hub in container mode (temporary feature flag)')
    .option('-l --leave-services-running', 'Leave dockerized services running, to improve future startup time')
    .option('--heartbeat', 'Shut down after not receiving a heartbeat from ember-cli')
    .parse(process.argv);

  if (commander.args.length < 1) {
    commander.outputHelp();
    process.exit(-1);
  }

  commander.seedConfigDirectory = path.resolve(commander.args[0]);

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
    process.stderr.write("You must provide a CardStack session encryption secret, via the CARDSTACK_SESSIONS_KEY or CARDSTACK_SESSIONS_KEY_FILE environment variables. You can generate one by running @cardstack/hub/bin/generate-key.js\n");
    process.exit(-1);
  }

  return commander;
}

function loadSeedModels(options) {
  try {
    return fs.readdirSync(options.seedConfigDirectory).map(filename => {
      if (/\.js$/.test(filename)) {
        return require(path.join(options.seedConfigDirectory, filename));
      } else {
        return [];
      }
    }).reduce((a,b) => a.concat(b), []);
  } catch (err) {
    process.stderr.write(`Unable to load models from your seed-config-file (${options.seedConfigFile}), ${err}\n`);
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
let seedModels = loadSeedModels(options);
runServer(options, seedModels);
