/* eslint-disable no-console */
const commandLineArgs = require('command-line-args');
const getUsage = require('command-line-usage');
const IndexBuilder = require('../cardstack/transaction-index-builder');

const optionDefs = [
  { name: 'jsonRpcUrl', alias: 'j', type: String, description: 'The URL of the Ethereum JSON RPC API.' },
  { name: 'start', alias: 's', type: Number, description: '(Optional) The block number to start building the index from. Defaults to "0".' },
  { name: 'end', alias: 'e', type: String, description: '(Optional) The block number to finish building the index from. Defaults to "latest".' },
  { name: 'jobName', alias: 'n', type: String, description: '(Optional) The worker job name (useful for logging)'},
  { name: 'progressFrequency', alias: 'p', type: Number, description: '(Optional) the frequency of reporting progress in terms of the number of blocks processed. Defaults to reporting progress every 100 blocks.'},
  { name: 'help', alias: 'h', type: Boolean, description: 'Display this usage guide.' }
];

const usage = [{
  header: 'build-index-worker.js',
  content: 'This script constructs the Ethereum Transaction index for a range of blocks.'
}, {
  header: 'Options',
  optionList: optionDefs
}];

const { start, end, jobName, progressFrequency, jsonRpcUrl, help } = commandLineArgs(optionDefs);
if (!jsonRpcUrl) {
  console.error("Missing JSON RPC URL specification.");
  console.log(getUsage(usage));
  process.exit(1);
}
if (help) {
  console.log(getUsage(usage));
  process.exit(0);
}

const fromBlockHeight = start || 0;
const toBlockHeight = end || 'latest';
const workerAttribution = jobName ? `Worker ${jobName} - ` : '';
let index = new IndexBuilder(jsonRpcUrl);

console.log(`${workerAttribution}Building transaction index from block ${fromBlockHeight} to ${toBlockHeight}`);

index.buildIndex({ fromBlockHeight, toBlockHeight, jobName, progressFrequency })
  .catch(err => {
    console.error(`${workerAttribution}${err.message}`, err);
    process.exit(1);
  })
  .then(() => {
    console.log(`${workerAttribution}Completed building transaction index from block ${fromBlockHeight} to ${toBlockHeight}.`);
    process.exit(0);
  });
