/* eslint-disable no-console */
const commandLineArgs = require('command-line-args');
const getUsage = require('command-line-usage');
const { fork } = require('child_process');
const path = require('path');
const Web3 = require('web3');
const { promisify } = require('util');
const sleep = promisify(setTimeout);
const IndexBuilder = require('../cardstack/transaction-index-builder');

const optionDefs = [
  { name: 'jsonRpcUrl', alias: 'j', type: String, description: 'The URL of the Ethereum JSON RPC API.' },
  { name: 'createDb', alias: 'c', type: Boolean, description: '(Optional) Only create the Ethereum Index database--dont add records to the database. No need to specify the --jsonRpcUrl when specifying this option.' },
  { name: 'start', alias: 's', type: Number, description: '(Optional) The block number to start building the index from. Defaults to "0".' },
  { name: 'end', alias: 'e', type: String, description: '(Optional) The block number to finish building the index from. Defaults to "latest".' },
  { name: 'workerCount', alias: 'w', type: String, description: '(Optional) The number of workers to provision to index blocks. Default is 10 workers.' },
  { name: 'progressFrequency', alias: 'p', type: Number, description: '(Optional) the frequency of reporting progress in terms of the number of blocks processed. Defaults to reporting progress every 100 blocks.' },
  { name: 'help', alias: 'h', type: Boolean, description: 'Display this usage guide.' }
];

const usage = [{
  header: 'build-index.js',
  content: 'This script coordinates individual build-index-workers.js workers to concurrently construct the Ehtereum Transaction index orver a range of blocks.'
}, {
  header: 'Options',
  optionList: optionDefs
}];

const { start, end, workerCount, createDb, progressFrequency, jsonRpcUrl, help } = commandLineArgs(optionDefs);
if (!jsonRpcUrl && !createDb) {
  console.error("Missing JSON RPC URL specification.");
  console.log(getUsage(usage));
  process.exit(1);
}
if (help) {
  console.log(getUsage(usage));
  process.exit(0);
}

if (createDb) {
  let index = new IndexBuilder();
  index.ensureDatabaseSetup().then(() => {
    console.log(`Database setup complete.`);
    process.exit(0);
  }).catch(err => {
    console.error(`Error setting up the database: ${err.message}`, err);
    process.exit(1);
  });
} else {
  try {
    let provider = new Web3(new Web3.providers.WebsocketProvider(jsonRpcUrl));
    const fromBlockHeight = start || 0;
    const toBlockHeight = end || 'latest';

    let workers = {};
    let exitingWithErrors;
    provider.eth.getBlockNumber().then(async latestBlockHeight => {
      let rangeEnd = toBlockHeight === 'latest' ? latestBlockHeight : toBlockHeight;
      let workerBlockRange = Math.round((rangeEnd - fromBlockHeight) / workerCount);
      for (let workerIndex = 0; workerIndex < workerCount; workerIndex++) {
        let workerStartBlock = fromBlockHeight + (workerIndex * workerBlockRange);
        let workerEndBlock;
        if (workerIndex === workerCount - 1 && toBlockHeight === 'latest') {
          workerEndBlock = 'latest';
        } else {
          workerEndBlock = workerStartBlock + workerBlockRange;
        }

        let worker = fork(path.join(__dirname, 'build-index-worker.js'), [
          `--jsonRpcUrl=${jsonRpcUrl}`,
          `--start=${workerStartBlock}`,
          `--end=${workerEndBlock}`,
          `--jobName=#${workerIndex}`,
          `--progressFrequency=${progressFrequency}`
        ], {
            env: {
              HUB_ENVIRONMENT: process.env.HUB_ENVIRONMENT || 'production',
              LOG_LEVELS: process.env.LOG_LEVELS,
              PGHOST: process.env.PGHOST,
              PGPORT: process.env.PGPORT,
              PGUSER: process.env.PGUSER,
              PGPASSWORD: process.env.PGPASSWORD
            }
          });
        workers[`worker${workerIndex}`] = worker;

        worker.on('exit', code => {
          if (code !== 0) {
            console.error(`ERROR: The build-index worker #${workerIndex} responsible for indexing blocks ${workerStartBlock} - ${workerEndBlock} has exited unsuccessfully.`);
            exitingWithErrors = exitingWithErrors || true;
          }

          delete workers[`worker${workerIndex}`];
          if (!Object.keys(workers).length) {
            if (exitingWithErrors) {
              console.error(`Finished indexing with errors. Please review the effected block ranges that encountered errors.`);
            } else {
              console.log(`Completed indexing successfully block range ${fromBlockHeight} - ${toBlockHeight}`);
            }
            process.exit(exitingWithErrors ? 1 : 0);
          }
        });

        await sleep(1000);
      }
    });
  } catch (err) {
    console.error(`${err.message}`, err);
    process.exit(1);
  }
}

