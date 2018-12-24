
const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('@cardstack/test-support/env');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
const { promisify } = require('./helpers');

const sendTransaction = promisify(web3.eth.sendTransaction);
const getTransaction = promisify(web3.eth.getTransaction);
const getBalance = promisify(web3.eth.getBalance);
const getBlock = promisify(web3.eth.getBlock);

let transactionIndexer, ethereumClient, env, searchers, ignoredTxns;

async function teardown() {
  await transactionIndexer._indexingPromise;
  await ethereumClient.stopAll();
  await destroyDefaultEnvironment(env);
}

async function waitForEthereumEvents(indexer) {
  await indexer._indexingPromise;
}

async function createTrackedEthereumAddress(address) {
  let trackedAddress = await env.lookup('hub:writers').create('master', env.session, 'tracked-ethereum-addresses', {
    data: { id: address, type: 'tracked-ethereum-addresses' }
  });
  await waitForEthereumEvents(transactionIndexer);

  return trackedAddress;
}

function txnsForCurrentTest(txnResources) {
  return txnResources.filter(i => !ignoredTxns.includes(i.id));
}

async function getTransactionsFromLatestBlockAndEarlier() {
  let currentBlock = await getBlock('latest');
  let allTransactions = [];
  for (let i = 0; i <= currentBlock.number; i++) {
    let { transactions } = await getBlock(i);
    allTransactions = allTransactions.concat(transactions || []);
  }
  return allTransactions;
}

contract('User Ethereum Addresses', function (accounts) {
  const from = accounts[0].toLowerCase();
  const to = accounts[1].toLowerCase();
  const gasPrice = web3.toWei(5, 'gwei');

  describe('@cardstack/ethereum - users', function () {
  });

});