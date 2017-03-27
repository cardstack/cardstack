const { makeServer } = require('../main');
const commander = require('commander');
const path = require('path');
const logger = require('heimdalljs-logger');
const log = logger('server');

async function runServer(port, seedModels) {
  let app = await makeServer(port, seedModels);
  app.listen(port);
  log.info("server listening on %s", port);
}

function commandLineOptions() {
  commander
    .usage('[options] <seed-config-file>')
    .option('-p --port <port>', 'Server listen port.', 3000)
    .parse(process.argv);

  if (commander.args.length < 1) {
    commander.outputHelp();
    process.exit(-1);
  }

  commander.seedConfigFile = path.resolve(commander.args[0]);
  return commander;
}

function loadSeedModels(options) {
  try {
    return require(options.seedConfigFile);
  } catch (err) {
    process.stderr.write(`Unable to load models from your seed-config-file (${options.seedConfigFile}), ${err}\n`);
    process.exit(-1);
  }
}

process.on('warning', (warning) => {
  process.stderr.write(warning.stack);
});

let options = commandLineOptions();
let seedModels = loadSeedModels(options);
runServer(options.port, seedModels);
