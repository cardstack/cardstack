const Koa = require('koa');
const Searcher = require('@cardstack/elasticsearch/searcher');
const Writers = require('@cardstack/server/writers');
const SchemaCache = require('@cardstack/server/schema-cache');
const Indexers = require('@cardstack/server/indexers');
const logger = require('heimdalljs-logger');
const log = logger('server');
const commander = require('commander');
const path = require('path');

async function wireItUp(seedModels) {
  let schemaCache = new SchemaCache(seedModels);
  let indexers = new Indexers(schemaCache);
  setInterval(() => indexers.update(), 1000);
  let writers = new Writers(schemaCache);
  writers.addListener('changed', what => indexers.update({ hints: [ what ] }));
  await indexers.update();
  let searcher = new Searcher(schemaCache);
  return { searcher, writers };
}

async function runServer(port, seedModels) {
  let { searcher, writers } = await wireItUp(seedModels);
  let app = new Koa();
  app.use(httpLogging);
  app.use(require('@cardstack/jsonapi/middleware')(searcher, writers));
  app.listen(port);
  log.info("server listening on %s", port);
}

async function httpLogging(ctxt, next) {
  await next();
  log.info('%s %s %s', ctxt.request.method, ctxt.request.url, ctxt.response.status);
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
