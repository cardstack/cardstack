const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('@cardstack/test-support/env');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

const sendTransaction = promisify(web3.eth.sendTransaction);
const getTransaction = promisify(web3.eth.getTransaction);
const getTransactionReceipt = promisify(web3.eth.getTransactionReceipt);
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

async function assertTxnResourceMatchesEthTxn(actualTxn, expectedTxn, block) {
  let receipt = await getTransactionReceipt(expectedTxn.hash);
  let expectedStatus = Boolean(parseInt(receipt.status, 16));

  expect(actualTxn).has.deep.property('attributes.block-number', expectedTxn.blockNumber);
  expect(actualTxn).has.deep.property('attributes.timestamp', block.timestamp);
  expect(actualTxn).has.deep.property('attributes.transaction-hash', expectedTxn.hash);
  expect(actualTxn).has.deep.property('attributes.block-hash', expectedTxn.blockHash);
  expect(actualTxn).has.deep.property('attributes.transaction-nonce', expectedTxn.nonce);
  expect(actualTxn).has.deep.property('attributes.transaction-index', expectedTxn.transactionIndex);
  expect(actualTxn).has.deep.property('attributes.transaction-value', expectedTxn.value.toString());
  expect(actualTxn).has.deep.property('attributes.gas', expectedTxn.gas);
  expect(actualTxn).has.deep.property('attributes.gas-price', expectedTxn.gasPrice.toString());
  expect(actualTxn).has.deep.property('attributes.transaction-data', expectedTxn.input);
  expect(actualTxn).has.deep.property('attributes.transaction-successful', expectedStatus);
  expect(actualTxn).has.deep.property('attributes.gas-used', receipt.gasUsed);
  expect(actualTxn).has.deep.property('attributes.cumulative-gas-used', receipt.cumulativeGasUsed);
}

contract('ethereum-addresses indexing', function (accounts) {
  const from = accounts[0].toLowerCase();
  const to = accounts[1].toLowerCase();
  const gasPrice = web3.toWei(5, 'gwei');

  describe('@cardstack/ethereum - ethereum-addresses', function () {
    async function setup() {
      let factory = new JSONAPIFactory();

      factory.addResource('data-sources', 'etherem-addresses')
        .withAttributes({
          'source-type': '@cardstack/ethereum',
          params: {
            jsonRpcUrl: "ws://localhost:7545",
            addressIndexing: {
              trackedAddressDataSource: 'default-data-source',
              maxAddressesTracked: 100
            }
          },
        });

      for (let address of accounts) {
        let balance = await getBalance(address);
        if (web3.fromWei(balance).toNumber() < 1) {
          throw new Error(`Not enough ETH in test accounts to conduct tests. Restart test blockchain to replenish ETH.`);
        }
      }

      env = await createDefaultEnvironment(`${__dirname}/..`, factory.getModels());
      searchers = env.lookup('hub:searchers');
      transactionIndexer = env.lookup(`plugin-services:${require.resolve('../cardstack/transaction-indexer')}`);
      ethereumClient = transactionIndexer.ethereumClient;

      await waitForEthereumEvents(transactionIndexer);

      await createTrackedEthereumAddress(from);
      await createTrackedEthereumAddress(to);

      ignoredTxns = await getTransactionsFromLatestBlockAndEarlier();
    }

    beforeEach(setup);
    afterEach(teardown);

    it('can index address for a spend of ethers', async function () {
      const value = web3.toWei(0.1, 'ether');
      let txnHash = await sendTransaction({ from, to, value, gasPrice });
      let txn = await getTransaction(txnHash);
      let block = await getBlock(txn.blockNumber);
      let senderBalance = await getBalance(from);

      await waitForEthereumEvents(transactionIndexer);
      let { data: sender } = await searchers.getFromControllingBranch(env.session, 'ethereum-addresses', from);

      expect(sender).has.deep.property('attributes.ethereum-address', web3.toChecksumAddress(from));
      expect(sender).has.deep.property('attributes.balance', senderBalance.toString());
      expect(txnsForCurrentTest(sender.relationships.transactions.data)).to.eql([{ type: 'ethereum-transactions', id: txn.hash }]);
      expect(sender).to.not.have.deep.property('meta.loadingTransactions');
      expect(sender).has.deep.property('meta.blockHeight', block.number);
      expect(sender).has.deep.property('meta.version', txn.nonce);

      // testing that this doesnt error
      await searchers.getFromControllingBranch(env.session, 'tracked-ethereum-addresses', from);

      let { data: transaction } = await searchers.getFromControllingBranch(env.session, 'ethereum-transactions', txn.hash);
      await assertTxnResourceMatchesEthTxn(transaction, txn, block);
      expect(transaction.relationships['to-address'].data).to.eql({ type: 'ethereum-addresses', id: to });
      expect(transaction.relationships['from-address'].data).to.eql({ type: 'ethereum-addresses', id: from });
    });

    it('can index address for receipt of ethers', async function () {
      const value = web3.toWei(0.1, 'ether');
      let txnHash = await sendTransaction({ from, to, value, gasPrice });
      let txn = await getTransaction(txnHash);
      let block = await getBlock(txn.blockNumber);
      let recipientBalance = await getBalance(to);

      await waitForEthereumEvents(transactionIndexer);
      let { data: recipient } = await searchers.getFromControllingBranch(env.session, 'ethereum-addresses', to);

      expect(recipient).has.deep.property('attributes.ethereum-address', web3.toChecksumAddress(to));
      expect(recipient).has.deep.property('attributes.balance', recipientBalance.toString());
      expect(txnsForCurrentTest(recipient.relationships.transactions.data)).to.eql([{ type: 'ethereum-transactions', id: txn.hash }]);
      expect(recipient).to.not.have.deep.property('meta.loadingTransactions');
      expect(recipient).has.deep.property('meta.blockHeight', block.number);
      expect(recipient).has.deep.property('meta.version', txn.nonce);

      // testing that this doesnt error
      await searchers.getFromControllingBranch(env.session, 'tracked-ethereum-addresses', to);

      let { data: transaction } = await searchers.getFromControllingBranch(env.session, 'ethereum-transactions', txn.hash);
      await assertTxnResourceMatchesEthTxn(transaction, txn, block);
      expect(transaction.relationships['to-address'].data).to.eql({ type: 'ethereum-addresses', id: to });
      expect(transaction.relationships['from-address'].data).to.eql({ type: 'ethereum-addresses', id: from });
    });

    it('can represent multiple transactions for a sender`s address', async function () {
      const value = web3.toWei(0.1, 'ether');

      let txnHash = await sendTransaction({ from, to, value, gasPrice });
      let txn1 = await getTransaction(txnHash);

      txnHash = await sendTransaction({ from, to, value, gasPrice });
      let txn2 = await getTransaction(txnHash);

      txnHash = await sendTransaction({ from, to, value, gasPrice });
      let txn3 = await getTransaction(txnHash);
      let block = await getBlock(txn3.blockNumber);

      await waitForEthereumEvents(transactionIndexer);
      let { data: sender } = await searchers.getFromControllingBranch(env.session, 'ethereum-addresses', from);
      expect(txnsForCurrentTest(sender.relationships.transactions.data)).to.eql([
        { type: 'ethereum-transactions', id: txn1.hash },
        { type: 'ethereum-transactions', id: txn2.hash },
        { type: 'ethereum-transactions', id: txn3.hash }
      ]);
      expect(sender).to.not.have.deep.property('meta.loadingTransactions');
      expect(sender).has.deep.property('meta.blockHeight', block.number);
      expect(sender).has.deep.property('meta.version', txn3.nonce);
    });

    it('can represent multiple transactions for a recipient`s address', async function () {
      const value = web3.toWei(0.1, 'ether');

      let txnHash = await sendTransaction({ from, to, value, gasPrice });
      let txn1 = await getTransaction(txnHash);

      txnHash = await sendTransaction({ from, to, value, gasPrice });
      let txn2 = await getTransaction(txnHash);

      txnHash = await sendTransaction({ from, to, value, gasPrice });
      let txn3 = await getTransaction(txnHash);
      let block = await getBlock(txn3.blockNumber);

      await waitForEthereumEvents(transactionIndexer);
      let { data: recipient } = await searchers.getFromControllingBranch(env.session, 'ethereum-addresses', to);
      expect(txnsForCurrentTest(recipient.relationships.transactions.data)).to.eql([
        { type: 'ethereum-transactions', id: txn1.hash },
        { type: 'ethereum-transactions', id: txn2.hash },
        { type: 'ethereum-transactions', id: txn3.hash }
      ]);
      expect(recipient).to.not.have.deep.property('meta.loadingTransactions');
      expect(recipient).has.deep.property('meta.blockHeight', block.number);
      expect(recipient).has.deep.property('meta.version', txn3.nonce);
    });

    it('can index past transactions for an address that has sent ethers', async function () {
      const value = web3.toWei(0.1, 'ether');
      const sender = accounts[2].toLowerCase();
      const recipient = accounts[3].toLowerCase();

      let txnHash = await sendTransaction({ from: sender, to: recipient, value, gasPrice });
      let txn1 = await getTransaction(txnHash);
      let block1 = await getBlock(txn1.blockNumber);

      txnHash = await sendTransaction({ from: sender, to: recipient, value, gasPrice });
      let txn2 = await getTransaction(txnHash);
      let block2 = await getBlock(txn2.blockNumber);

      txnHash = await sendTransaction({ from: sender, to: recipient, value, gasPrice });
      let txn3 = await getTransaction(txnHash);
      let block3 = await getBlock(txn3.blockNumber);

      let senderBalance = await getBalance(sender);

      await waitForEthereumEvents(transactionIndexer);

      await createTrackedEthereumAddress(sender);

      let { data: senderDoc } = await searchers.getFromControllingBranch(env.session, 'ethereum-addresses', sender);

      expect(senderDoc).has.deep.property('attributes.ethereum-address', web3.toChecksumAddress(sender));
      expect(senderDoc).has.deep.property('attributes.balance', senderBalance.toString());
      expect(senderDoc).to.not.have.deep.property('meta.loadingTransactions');
      expect(senderDoc).has.deep.property('meta.blockHeight', block3.number);
      expect(senderDoc).has.deep.property('meta.version', txn3.nonce);
      expect(txnsForCurrentTest(senderDoc.relationships.transactions.data)).to.eql([
        { type: 'ethereum-transactions', id: txn1.hash },
        { type: 'ethereum-transactions', id: txn2.hash },
        { type: 'ethereum-transactions', id: txn3.hash }
      ]);

      let { data: transaction1 } = await searchers.getFromControllingBranch(env.session, 'ethereum-transactions', txn1.hash);
      await assertTxnResourceMatchesEthTxn(transaction1, txn1, block1);
      expect(transaction1.relationships['to-address'].data).to.eql({ type: 'ethereum-addresses', id: recipient });
      expect(transaction1.relationships['from-address'].data).to.eql({ type: 'ethereum-addresses', id: sender });

      let { data: transaction2 } = await searchers.getFromControllingBranch(env.session, 'ethereum-transactions', txn2.hash);
      await assertTxnResourceMatchesEthTxn(transaction2, txn2, block2);
      expect(transaction2.relationships['to-address'].data).to.eql({ type: 'ethereum-addresses', id: recipient });
      expect(transaction2.relationships['from-address'].data).to.eql({ type: 'ethereum-addresses', id: sender });

      let { data: transaction3 } = await searchers.getFromControllingBranch(env.session, 'ethereum-transactions', txn3.hash);
      await assertTxnResourceMatchesEthTxn(transaction3, txn3, block3);
      expect(transaction3.relationships['to-address'].data).to.eql({ type: 'ethereum-addresses', id: recipient });
      expect(transaction3.relationships['from-address'].data).to.eql({ type: 'ethereum-addresses', id: sender });
    });

    it('can index past transactions for an address that has received ethers', async function () {
      const value = web3.toWei(0.1, 'ether');
      const sender = accounts[2].toLowerCase();
      const recipient = accounts[3].toLowerCase();

      let txnHash = await sendTransaction({ from: sender, to: recipient, value, gasPrice });
      let txn1 = await getTransaction(txnHash);
      let block1 = await getBlock(txn1.blockNumber);

      txnHash = await sendTransaction({ from: sender, to: recipient, value, gasPrice });
      let txn2 = await getTransaction(txnHash);
      let block2 = await getBlock(txn2.blockNumber);

      txnHash = await sendTransaction({ from: sender, to: recipient, value, gasPrice });
      let txn3 = await getTransaction(txnHash);
      let block3 = await getBlock(txn3.blockNumber);

      let recipientBalance = await getBalance(recipient);

      await waitForEthereumEvents(transactionIndexer);

      await createTrackedEthereumAddress(recipient);

      let { data: recipientDoc } = await searchers.getFromControllingBranch(env.session, 'ethereum-addresses', recipient);

      expect(recipientDoc).has.deep.property('attributes.ethereum-address', web3.toChecksumAddress(recipient));
      expect(recipientDoc).has.deep.property('attributes.balance', recipientBalance.toString());
      expect(recipientDoc).to.not.have.deep.property('meta.loadingTransactions');
      expect(recipientDoc).has.deep.property('meta.blockHeight', block3.number);
      expect(recipientDoc).has.deep.property('meta.version', txn3.nonce);
      expect(txnsForCurrentTest(recipientDoc.relationships.transactions.data)).to.eql([
        { type: 'ethereum-transactions', id: txn1.hash },
        { type: 'ethereum-transactions', id: txn2.hash },
        { type: 'ethereum-transactions', id: txn3.hash }
      ]);

      let { data: transaction1 } = await searchers.getFromControllingBranch(env.session, 'ethereum-transactions', txn1.hash);
      await assertTxnResourceMatchesEthTxn(transaction1, txn1, block1);
      expect(transaction1.relationships['to-address'].data).to.eql({ type: 'ethereum-addresses', id: recipient });
      expect(transaction1.relationships['from-address'].data).to.eql({ type: 'ethereum-addresses', id: sender });

      let { data: transaction2 } = await searchers.getFromControllingBranch(env.session, 'ethereum-transactions', txn2.hash);
      await assertTxnResourceMatchesEthTxn(transaction2, txn2, block2);
      expect(transaction2.relationships['to-address'].data).to.eql({ type: 'ethereum-addresses', id: recipient });
      expect(transaction2.relationships['from-address'].data).to.eql({ type: 'ethereum-addresses', id: sender });

      let { data: transaction3 } = await searchers.getFromControllingBranch(env.session, 'ethereum-transactions', txn3.hash);
      await assertTxnResourceMatchesEthTxn(transaction3, txn3, block3);
      expect(transaction3.relationships['to-address'].data).to.eql({ type: 'ethereum-addresses', id: recipient });
      expect(transaction3.relationships['from-address'].data).to.eql({ type: 'ethereum-addresses', id: sender });
    });

    it('can index past transactions when account has both sent and received ethers', async function () {
      const value = web3.toWei(0.1, 'ether');
      const addressX = accounts[2].toLowerCase();
      const addressY = accounts[3].toLowerCase();

      let txnHash = await sendTransaction({ from: addressX, to: addressY, value, gasPrice });
      let txn1 = await getTransaction(txnHash);
      let block1 = await getBlock(txn1.blockNumber);

      txnHash = await sendTransaction({ from: addressY, to: addressX, value, gasPrice });
      let txn2 = await getTransaction(txnHash);
      let block2 = await getBlock(txn2.blockNumber);

      txnHash = await sendTransaction({ from: addressX, to: addressY, value, gasPrice });
      let txn3 = await getTransaction(txnHash);
      let block3 = await getBlock(txn3.blockNumber);

      let balance = await getBalance(addressY);

      await waitForEthereumEvents(transactionIndexer);

      await createTrackedEthereumAddress(addressY);

      let { data: recipientDoc } = await searchers.getFromControllingBranch(env.session, 'ethereum-addresses', addressY);

      expect(recipientDoc).has.deep.property('attributes.ethereum-address', web3.toChecksumAddress(addressY));
      expect(recipientDoc).has.deep.property('attributes.balance', balance.toString());
      expect(recipientDoc).to.not.have.deep.property('meta.loadingTransactions');
      expect(recipientDoc).has.deep.property('meta.blockHeight', block3.number);
      expect(recipientDoc).has.deep.property('meta.version', txn3.nonce);
      expect(txnsForCurrentTest(recipientDoc.relationships.transactions.data)).to.eql([
        { type: 'ethereum-transactions', id: txn1.hash },
        { type: 'ethereum-transactions', id: txn2.hash },
        { type: 'ethereum-transactions', id: txn3.hash }
      ]);

      let { data: transaction1 } = await searchers.getFromControllingBranch(env.session, 'ethereum-transactions', txn1.hash);
      await assertTxnResourceMatchesEthTxn(transaction1, txn1, block1);
      expect(transaction1.relationships['to-address'].data).to.eql({ type: 'ethereum-addresses', id: addressY });
      expect(transaction1.relationships['from-address'].data).to.eql({ type: 'ethereum-addresses', id: addressX });

      let { data: transaction2 } = await searchers.getFromControllingBranch(env.session, 'ethereum-transactions', txn2.hash);
      await assertTxnResourceMatchesEthTxn(transaction2, txn2, block2);
      expect(transaction2.relationships['to-address'].data).to.eql({ type: 'ethereum-addresses', id: addressX });
      expect(transaction2.relationships['from-address'].data).to.eql({ type: 'ethereum-addresses', id: addressY });

      let { data: transaction3 } = await searchers.getFromControllingBranch(env.session, 'ethereum-transactions', txn3.hash);
      await assertTxnResourceMatchesEthTxn(transaction3, txn3, block3);
      expect(transaction3.relationships['to-address'].data).to.eql({ type: 'ethereum-addresses', id: addressY });
      expect(transaction3.relationships['from-address'].data).to.eql({ type: 'ethereum-addresses', id: addressX });
    });

    it('can stop indexing address when the tracked-ethereum-address is removed', async function () {
      const value = web3.toWei(0.1, 'ether');
      const sender = accounts[2].toLowerCase();
      const recipient = accounts[3].toLowerCase();

      let { data: { meta: version } } = await createTrackedEthereumAddress(sender);

      let txnHash = await sendTransaction({ from: sender, to: recipient, value, gasPrice });
      let txn = await getTransaction(txnHash);

      await waitForEthereumEvents(transactionIndexer);

      await searchers.getFromControllingBranch(env.session, 'ethereum-transactions', txn.hash);
      await env.lookup('hub:writers').delete('master', env.session, version, 'tracked-ethereum-addresses', sender);

      let error = null;
      try {
        await searchers.getFromControllingBranch(env.session, 'ethereum-addresses', sender);
      } catch (e) {
        error = e;
      }
      expect(error.status).to.equal(404);

      error = null;
      try {
        await searchers.getFromControllingBranch(env.session, 'tracked-ethereum-addresses', sender);
      } catch (e) {
        error = e;
      }
      expect(error.status).to.equal(404);

      error = null;
      try {
        await searchers.getFromControllingBranch(env.session, 'ethereum-transactions', txn.hash);
      } catch (e) {
        error = e;
      }
      expect(error.status).to.equal(404);
    });

    it('can stop indexing address when it shares transactions with another address that is being tracked', async function () {
      const value = web3.toWei(0.1, 'ether');
      const sender = accounts[2].toLowerCase();
      const recipient = accounts[3].toLowerCase();

      let { data: { meta: version } } = await createTrackedEthereumAddress(sender);
      await createTrackedEthereumAddress(recipient);

      let txnHash = await sendTransaction({ from: sender, to: recipient, value, gasPrice });
      let txn = await getTransaction(txnHash);
      let block = await getBlock(txn.blockNumber);

      await waitForEthereumEvents(transactionIndexer);

      await searchers.getFromControllingBranch(env.session, 'ethereum-transactions', txn.hash);
      await env.lookup('hub:writers').delete('master', env.session, version, 'tracked-ethereum-addresses', sender);

      let error = null;
      try {
        await searchers.getFromControllingBranch(env.session, 'ethereum-addresses', sender);
      } catch (e) {
        error = e;
      }
      expect(error.status).to.equal(404);

      error = null;
      try {
        await searchers.getFromControllingBranch(env.session, 'tracked-ethereum-addresses', sender);
      } catch (e) {
        error = e;
      }
      expect(error.status).to.equal(404);

      let { data: transaction } = await searchers.getFromControllingBranch(env.session, 'ethereum-transactions', txn.hash);
      await assertTxnResourceMatchesEthTxn(transaction, txn, block);
      expect(transaction.relationships['to-address'].data).to.eql({ type: 'ethereum-addresses', id: recipient });
      expect(transaction.relationships['from-address'].data).to.eql({ type: 'ethereum-addresses', id: sender });
    });

    it('can search for transactions for a tracked address only in blocks that have not yet been processed (e.g. hub stops and restarts during which transactions have occurred)', async function () {
      const pgclient = await env.lookup(`plugin-client:${require.resolve('@cardstack/pgsearch/client')}`);
      const value = web3.toWei(0.1, 'ether');
      const ignoredSender = accounts[2].toLowerCase();
      const ignoredRecipient = accounts[3].toLowerCase();

      let txnHash = await sendTransaction({ from, to, value, gasPrice });
      let txn1 = await getTransaction(txnHash);
      let block1 = await getBlock(txn1.blockNumber);

      await waitForEthereumEvents(transactionIndexer);
      await ethereumClient.stopAll();

      let txnIndexingCount = 0;
      let addressIndexingCount = 0;

      pgclient.on('add', ({ type }) => {
        if (type === 'ethereum-addresses') {
          addressIndexingCount++;
        } else if (type === 'ethereum-transactions') {
          txnIndexingCount++;
        }
      });

      await sendTransaction({ from: ignoredSender, to: ignoredRecipient, value, gasPrice });

      await ethereumClient.startNewBlockListening(transactionIndexer);
      await env.lookup('hub:indexers').update({ forceRefresh: true });
      await waitForEthereumEvents(transactionIndexer);

      // no transactions occurred involving addesses we are tracking
      expect(addressIndexingCount).to.equal(0);
      expect(txnIndexingCount).to.equal(0);

      await waitForEthereumEvents(transactionIndexer);
      await ethereumClient.stopAll();

      txnHash = await sendTransaction({ from, to, value, gasPrice });
      let txn2 = await getTransaction(txnHash);
      let block2 = await getBlock(txn2.blockNumber);

      txnHash = await sendTransaction({ from, to, value, gasPrice });
      let txn3 = await getTransaction(txnHash);
      let block3 = await getBlock(txn3.blockNumber);

      let senderBalance = await getBalance(from);
      let recipientBalance = await getBalance(to);

      await ethereumClient.startNewBlockListening(transactionIndexer);
      await env.lookup('hub:indexers').update({ forceRefresh: true });
      await waitForEthereumEvents(transactionIndexer);

      // 2 events for update of the 2 addresses
      expect(addressIndexingCount).to.equal(2);

      // 2 events for the 2 transactions that were created
      expect(txnIndexingCount).to.equal(2);

      let { data: sender } = await searchers.getFromControllingBranch(env.session, 'ethereum-addresses', from);
      expect(sender).has.deep.property('attributes.balance', senderBalance.toString());
      expect(txnsForCurrentTest(sender.relationships.transactions.data)).to.eql([
        { type: 'ethereum-transactions', id: txn1.hash },
        { type: 'ethereum-transactions', id: txn2.hash },
        { type: 'ethereum-transactions', id: txn3.hash }
      ]);
      expect(sender).to.not.have.deep.property('meta.loadingTransactions');
      expect(sender).has.deep.property('meta.blockHeight', block3.number);
      expect(sender).has.deep.property('meta.version', txn3.nonce);

      let { data: recipient } = await searchers.getFromControllingBranch(env.session, 'ethereum-addresses', to);
      expect(recipient).has.deep.property('attributes.balance', recipientBalance.toString());
      expect(txnsForCurrentTest(recipient.relationships.transactions.data)).to.eql([
        { type: 'ethereum-transactions', id: txn1.hash },
        { type: 'ethereum-transactions', id: txn2.hash },
        { type: 'ethereum-transactions', id: txn3.hash }
      ]);
      expect(recipient).to.not.have.deep.property('meta.loadingTransactions');
      expect(recipient).has.deep.property('meta.blockHeight', block3.number);
      expect(recipient).has.deep.property('meta.version', txn3.nonce);

      let { data: transaction1 } = await searchers.getFromControllingBranch(env.session, 'ethereum-transactions', txn1.hash);
      await assertTxnResourceMatchesEthTxn(transaction1, txn1, block1);
      expect(transaction1.relationships['to-address'].data).to.eql({ type: 'ethereum-addresses', id: to });
      expect(transaction1.relationships['from-address'].data).to.eql({ type: 'ethereum-addresses', id: from });

      let { data: transaction2 } = await searchers.getFromControllingBranch(env.session, 'ethereum-transactions', txn2.hash);
      await assertTxnResourceMatchesEthTxn(transaction2, txn2, block2);
      expect(transaction2.relationships['to-address'].data).to.eql({ type: 'ethereum-addresses', id: to });
      expect(transaction2.relationships['from-address'].data).to.eql({ type: 'ethereum-addresses', id: from });

      let { data: transaction3 } = await searchers.getFromControllingBranch(env.session, 'ethereum-transactions', txn3.hash);
      await assertTxnResourceMatchesEthTxn(transaction3, txn3, block3);
      expect(transaction3.relationships['to-address'].data).to.eql({ type: 'ethereum-addresses', id: to });
      expect(transaction3.relationships['from-address'].data).to.eql({ type: 'ethereum-addresses', id: from });

      await ethereumClient.stopAll();

      txnHash = await sendTransaction({ from, to, value, gasPrice });
      let txn4 = await getTransaction(txnHash);
      let block4 = await getBlock(txn4.blockNumber);

      senderBalance = await getBalance(from);
      recipientBalance = await getBalance(to);

      await ethereumClient.startNewBlockListening(transactionIndexer);
      await env.lookup('hub:indexers').update({ forceRefresh: true });
      await waitForEthereumEvents(transactionIndexer);

      // 2 events for update of the 2 addresses
      expect(addressIndexingCount).to.equal(4);

      // 1 event for the 1 transaction that was created
      expect(txnIndexingCount).to.equal(3);

      let { data: senderUpdated } = await searchers.getFromControllingBranch(env.session, 'ethereum-addresses', from);
      expect(senderUpdated).has.deep.property('attributes.balance', senderBalance.toString());
      expect(txnsForCurrentTest(senderUpdated.relationships.transactions.data)).to.eql([
        { type: 'ethereum-transactions', id: txn1.hash },
        { type: 'ethereum-transactions', id: txn2.hash },
        { type: 'ethereum-transactions', id: txn3.hash },
        { type: 'ethereum-transactions', id: txn4.hash }
      ]);
      expect(senderUpdated).to.not.have.deep.property('meta.loadingTransactions');
      expect(senderUpdated).has.deep.property('meta.blockHeight', block4.number);
      expect(senderUpdated).has.deep.property('meta.version', txn4.nonce);

      let { data: recipientUpdated } = await searchers.getFromControllingBranch(env.session, 'ethereum-addresses', to);
      expect(recipientUpdated).has.deep.property('attributes.balance', recipientBalance.toString());
      expect(txnsForCurrentTest(recipientUpdated.relationships.transactions.data)).to.eql([
        { type: 'ethereum-transactions', id: txn1.hash },
        { type: 'ethereum-transactions', id: txn2.hash },
        { type: 'ethereum-transactions', id: txn3.hash },
        { type: 'ethereum-transactions', id: txn4.hash }
      ]);
      expect(recipientUpdated).to.not.have.deep.property('meta.loadingTransactions');
      expect(recipientUpdated).has.deep.property('meta.blockHeight', block4.number);
      expect(recipientUpdated).has.deep.property('meta.version', txn4.nonce);

      let { data: transaction4 } = await searchers.getFromControllingBranch(env.session, 'ethereum-transactions', txn4.hash);
      await assertTxnResourceMatchesEthTxn(transaction4, txn4, block4);
      expect(transaction4.relationships['to-address'].data).to.eql({ type: 'ethereum-addresses', id: to });
      expect(transaction4.relationships['from-address'].data).to.eql({ type: 'ethereum-addresses', id: from });
    });

    it('can rebuild ethereum-addresses and ethereum-transaction records if the tracked addresses are not in the index', async function () {
      const pgclient = await env.lookup(`plugin-client:${require.resolve('@cardstack/pgsearch/client')}`);
      const value = web3.toWei(0.1, 'ether');

      let txnHash = await sendTransaction({ from, to, value, gasPrice });
      let txn1 = await getTransaction(txnHash);
      let block1 = await getBlock(txn1.blockNumber);

      txnHash = await sendTransaction({ from, to, value, gasPrice });
      let txn2 = await getTransaction(txnHash);
      let block2 = await getBlock(txn2.blockNumber);

      txnHash = await sendTransaction({ from, to, value, gasPrice });
      let txn3 = await getTransaction(txnHash);
      let block3 = await getBlock(txn3.blockNumber);

      let senderBalance = await getBalance(from);
      let recipientBalance = await getBalance(to);

      await waitForEthereumEvents(transactionIndexer);

      let sql = 'delete from documents where branch=$1 and type=$2 and id=$3';
      for (let id of [from, to]) {
        await pgclient.query(sql, ['master', 'ethereum-addresses', id]);

        let error;
        try {
          await searchers.getFromControllingBranch(env.session, 'ethereum-addresses', id);
        } catch(e) {
          error = e;
        }
        expect(error.status).to.equal(404);
      }
      for (let id of [txn1.hash, txn2.hash, txn3.hash]) {
        await pgclient.query(sql, ['master', 'ethereum-transactions', id]);

        let error;
        try {
          await searchers.getFromControllingBranch(env.session, 'ethereum-transactions', id);
        } catch(e) {
          error = e;
        }
        expect(error.status).to.equal(404);
      }

      await env.lookup('hub:indexers').update({ forceRefresh: true });
      await waitForEthereumEvents(transactionIndexer);

      let { data: sender } = await searchers.getFromControllingBranch(env.session, 'ethereum-addresses', from);
      expect(sender).has.deep.property('attributes.balance', senderBalance.toString());
      expect(txnsForCurrentTest(sender.relationships.transactions.data)).to.eql([
        { type: 'ethereum-transactions', id: txn1.hash },
        { type: 'ethereum-transactions', id: txn2.hash },
        { type: 'ethereum-transactions', id: txn3.hash }
      ]);
      expect(sender).to.not.have.deep.property('meta.loadingTransactions');
      expect(sender).has.deep.property('meta.blockHeight', block3.number);
      expect(sender).has.deep.property('meta.version', txn3.nonce);

      let { data: recipient } = await searchers.getFromControllingBranch(env.session, 'ethereum-addresses', to);
      expect(recipient).has.deep.property('attributes.balance', recipientBalance.toString());
      expect(txnsForCurrentTest(recipient.relationships.transactions.data)).to.eql([
        { type: 'ethereum-transactions', id: txn1.hash },
        { type: 'ethereum-transactions', id: txn2.hash },
        { type: 'ethereum-transactions', id: txn3.hash }
      ]);
      expect(recipient).to.not.have.deep.property('meta.loadingTransactions');
      expect(recipient).has.deep.property('meta.blockHeight', block3.number);
      expect(recipient).has.deep.property('meta.version', txn3.nonce);

      let { data: transaction1 } = await searchers.getFromControllingBranch(env.session, 'ethereum-transactions', txn1.hash);
      await assertTxnResourceMatchesEthTxn(transaction1, txn1, block1);
      expect(transaction1.relationships['to-address'].data).to.eql({ type: 'ethereum-addresses', id: to });
      expect(transaction1.relationships['from-address'].data).to.eql({ type: 'ethereum-addresses', id: from });

      let { data: transaction2 } = await searchers.getFromControllingBranch(env.session, 'ethereum-transactions', txn2.hash);
      await assertTxnResourceMatchesEthTxn(transaction2, txn2, block2);
      expect(transaction2.relationships['to-address'].data).to.eql({ type: 'ethereum-addresses', id: to });
      expect(transaction2.relationships['from-address'].data).to.eql({ type: 'ethereum-addresses', id: from });

      let { data: transaction3 } = await searchers.getFromControllingBranch(env.session, 'ethereum-transactions', txn3.hash);
      await assertTxnResourceMatchesEthTxn(transaction3, txn3, block3);
      expect(transaction3.relationships['to-address'].data).to.eql({ type: 'ethereum-addresses', id: to });
      expect(transaction3.relationships['from-address'].data).to.eql({ type: 'ethereum-addresses', id: from });

    });

    it('can index a transaction where the sender and receiver are the same address', async function () {
      const value = web3.toWei(0.1, 'ether');
      let txnHash = await sendTransaction({ from, to: from, value, gasPrice });
      let txn = await getTransaction(txnHash);
      let block = await getBlock(txn.blockNumber);
      let senderBalance = await getBalance(from);

      await waitForEthereumEvents(transactionIndexer);
      let { data: sender } = await searchers.getFromControllingBranch(env.session, 'ethereum-addresses', from);

      expect(sender).has.deep.property('attributes.ethereum-address', web3.toChecksumAddress(from));
      expect(sender).has.deep.property('attributes.balance', senderBalance.toString());
      expect(txnsForCurrentTest(sender.relationships.transactions.data)).to.eql([{ type: 'ethereum-transactions', id: txn.hash }]);
      expect(sender).to.not.have.deep.property('meta.loadingTransactions');
      expect(sender).has.deep.property('meta.blockHeight', block.number);
      expect(sender).has.deep.property('meta.version', txn.nonce);

      // testing that this doesnt error
      await searchers.getFromControllingBranch(env.session, 'tracked-ethereum-addresses', from);

      let { data: transaction } = await searchers.getFromControllingBranch(env.session, 'ethereum-transactions', txn.hash);
      await assertTxnResourceMatchesEthTxn(transaction, txn, block);
      expect(transaction.relationships['to-address'].data).to.eql({ type: 'ethereum-addresses', id: from });
      expect(transaction.relationships['from-address'].data).to.eql({ type: 'ethereum-addresses', id: from });
    });

    it('can index a past transaction where the sender and receiver are the same address', async function () {
      const value = web3.toWei(0.1, 'ether');
      const sender = accounts[2].toLowerCase();

      let txnHash = await sendTransaction({ from: sender, to: sender, value, gasPrice });
      let txn = await getTransaction(txnHash);
      let block = await getBlock(txn.blockNumber);

      let senderBalance = await getBalance(sender);

      await waitForEthereumEvents(transactionIndexer);

      await createTrackedEthereumAddress(sender);

      let { data: senderDoc } = await searchers.getFromControllingBranch(env.session, 'ethereum-addresses', sender);

      expect(senderDoc).has.deep.property('attributes.ethereum-address', web3.toChecksumAddress(sender));
      expect(senderDoc).has.deep.property('attributes.balance', senderBalance.toString());
      expect(senderDoc).to.not.have.deep.property('meta.loadingTransactions');
      expect(senderDoc).has.deep.property('meta.blockHeight', block.number);
      expect(senderDoc).has.deep.property('meta.version', txn.nonce);
      expect(txnsForCurrentTest(senderDoc.relationships.transactions.data)).to.eql([
        { type: 'ethereum-transactions', id: txn.hash },
      ]);

      let { data: transaction } = await searchers.getFromControllingBranch(env.session, 'ethereum-transactions', txn.hash);
      await assertTxnResourceMatchesEthTxn(transaction, txn, block);
      expect(transaction.relationships['to-address'].data).to.eql({ type: 'ethereum-addresses', id: sender });
      expect(transaction.relationships['from-address'].data).to.eql({ type: 'ethereum-addresses', id: sender });
    });

    it('can index a tracked address that has no transactions', async function() {
      // need to manufacture a valid address that has not been funded by ganache
      const trackedAddress = accounts[2].toLowerCase().substring(0, accounts[2].length - 4) + '0000';
      let block = await getBlock('latest');

      await createTrackedEthereumAddress(trackedAddress);

      let { data: addressDoc } = await searchers.getFromControllingBranch(env.session, 'ethereum-addresses', trackedAddress);

      expect(addressDoc).has.deep.property('attributes.ethereum-address', web3.toChecksumAddress(trackedAddress));
      expect(addressDoc).has.deep.property('attributes.balance', '0');
      expect(addressDoc).to.not.have.deep.property('meta.loadingTransactions');
      expect(addressDoc).has.deep.property('meta.blockHeight', block.number);
      expect(addressDoc).has.deep.property('meta.version', 0);
      expect(addressDoc.relationships.transactions.data).to.eql([]);
    });

    // This asserts that the promise chaining in the TransactonIndexer.index() is chaining the index requests appropriately
    it('can index a newly added tracked address that immediately appears in a mined block', async function() {
      const value = web3.toWei(0.1, 'ether');
      const sender = accounts[2].toLowerCase();
      const recipient = accounts[3].toLowerCase();

      let txnHash = await sendTransaction({ from: sender, to: recipient, value, gasPrice });
      let txn1 = await getTransaction(txnHash);

      await env.lookup('hub:writers').create('master', env.session, 'tracked-ethereum-addresses', {
        data: { id: sender, type: 'tracked-ethereum-addresses' }
      });
      // intentionally not awaiting ethereum events while hub looks for txns to index
      // and a new block mined event with an indexable txn will arrive while this occurs

      txnHash = await sendTransaction({ from: sender, to: recipient, value, gasPrice });
      let txn2 = await getTransaction(txnHash);
      let block2 = await getBlock(txn2.blockNumber);

      let senderBalance = await getBalance(sender);

      await waitForEthereumEvents(transactionIndexer);

      let { data: senderDoc } = await searchers.getFromControllingBranch(env.session, 'ethereum-addresses', sender);
      expect(senderDoc).has.deep.property('attributes.balance', senderBalance.toString());
      expect(txnsForCurrentTest(senderDoc.relationships.transactions.data)).to.eql([
        { type: 'ethereum-transactions', id: txn1.hash },
        { type: 'ethereum-transactions', id: txn2.hash },
      ]);
      expect(senderDoc).to.not.have.deep.property('meta.loadingTransactions');
      expect(senderDoc).has.deep.property('meta.blockHeight', block2.number);
      expect(senderDoc).has.deep.property('meta.version', txn2.nonce);
    });
  });
});

// having difficulty using node's util.promisify in the truffle tests, i think it's related to the context binding....
function promisify(fn) {
  return args => new Promise((res, rej) => {
    fn(args, (err, result) => {
      if (err) {
        rej(err);
      } else {
        res(result);
      }
    });
  });
}