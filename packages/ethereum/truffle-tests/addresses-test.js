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
const newAccount = promisify(web3.personal.newAccount);
const unlockAccount = promisify(web3.personal.unlockAccount);
const txnTestEthValue = 0.1;
const txnTestEthValueWithGasFee = 0.101;

let transactionIndexer, ethereumClient, env, searchers, accounts, gasPrice;

async function teardown() {
  await transactionIndexer._eventProcessingPromise;
  await transactionIndexer._indexingPromise;
  await ethereumClient.stopAll();
  await destroyDefaultEnvironment(env);
}

// need to manufacture a valid address that has not been funded by ganache so it has a clean txn history
async function newAddress(fundingSource, value) {
  const address = await newAccount('password');
  await unlockAccount(address, 'password', 600);

  let txn;
  if (fundingSource && value) {
    txn = await fundAddress(fundingSource, address, value);
  }

  return { address: address.toLowerCase(), txn };
}

async function fundAddress(fundingSource, recipient, value) {
  let txnHash = await sendTransaction({ from: fundingSource, to: recipient, value, gasPrice });
  return await getTransaction(txnHash);
}

function setup(factoryCallback) {
  return async () => {
    let factory = new JSONAPIFactory();

    if (typeof factoryCallback === 'function') {
      await factoryCallback(factory);
    }

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
  };
}

async function waitForEthereumEvents(indexer) {
  await indexer._eventProcessingPromise;
  await indexer._indexingPromise;
}

async function createTrackedEthereumAddress(address) {
  let trackedAddress = await env.lookup('hub:writers').create('master', env.session, 'tracked-ethereum-addresses', {
    data: { id: address, type: 'tracked-ethereum-addresses' }
  });
  await waitForEthereumEvents(transactionIndexer);

  return trackedAddress;
}

async function createTrackedEthereumAddresses(addresses) {
  let trackedAddresses = await env.lookup('hub:writers').create('master', env.session, 'tracked-ethereum-addresses', {
    data: {
      type: 'tracked-ethereum-addresses',
      attributes: {
        'tracked-addresses': addresses
      }
    }
  });
  await waitForEthereumEvents(transactionIndexer);

  return trackedAddresses;
}

async function setupTrackedAddresses(fundingSource, fundingAmount) {
  const { address: from } = await newAddress();
  const { address: to } = await newAddress();
  let txn, fromResource, toResource;

  if (fundingSource && fundingAmount) {
    txn = await fundAddress(accounts[0], from, fundingAmount);

    await waitForEthereumEvents(transactionIndexer);
    fromResource = await createTrackedEthereumAddress(from);
    toResource = await createTrackedEthereumAddress(to);
  }
  return { from, to, txn, fromResource, toResource };
}

async function assertTxnResourceMatchesEthTxn(actualTxn, expectedTxn, block) {
  let receipt = await getTransactionReceipt(expectedTxn.hash);
  let expectedStatus = Boolean(parseInt(receipt.status, 16));

  expect(actualTxn).has.deep.property('attributes.block-number', expectedTxn.blockNumber);
  expect(actualTxn).has.deep.property('attributes.transaction-hash', expectedTxn.hash);
  expect(actualTxn).has.deep.property('attributes.block-hash', expectedTxn.blockHash);
  expect(actualTxn).has.deep.property('attributes.transaction-nonce', expectedTxn.nonce);
  expect(actualTxn).has.deep.property('attributes.transaction-index', expectedTxn.transactionIndex);
  expect(actualTxn).has.deep.property('attributes.transaction-value', expectedTxn.value.toString());
  expect(actualTxn).has.deep.property('attributes.transaction-from', expectedTxn.from.toLowerCase());
  expect(actualTxn).has.deep.property('attributes.transaction-to', expectedTxn.to.toLowerCase());
  expect(actualTxn).has.deep.property('attributes.gas', expectedTxn.gas);
  expect(actualTxn).has.deep.property('attributes.gas-price', expectedTxn.gasPrice.toString());
  expect(actualTxn).has.deep.property('attributes.transaction-data', expectedTxn.input);
  expect(actualTxn).has.deep.property('attributes.transaction-successful', expectedStatus);
  expect(actualTxn).has.deep.property('attributes.gas-used', receipt.gasUsed);
  expect(actualTxn).has.deep.property('attributes.cumulative-gas-used', receipt.cumulativeGasUsed);
  expect(Math.abs(actualTxn.attributes.timestamp - block.timestamp) <= 1).to.equal(true); // ganache (our private blockchain) seems to be fudging this a bit. give it a 1 sec tolerance
}

contract('ethereum-addresses indexing', function (_accounts) {
  accounts = _accounts;
  gasPrice = web3.toWei(5, 'gwei');

  describe('@cardstack/ethereum - ethereum-addresses', function () {
    describe('using tracked address model as an id field', function () {
      beforeEach(setup(factory => {
        factory.addResource('data-sources', 'ethereum-addresses')
          .withAttributes({
            'source-type': '@cardstack/ethereum',
            params: {
              jsonRpcUrl: "ws://localhost:7545",
              addressIndexing: {
                trackedAddressContentType: 'tracked-ethereum-addresses',
                trackedAddressField: 'id',
                maxAddressesTracked: 100,
              }
            },
          });

        factory.addResource('content-types', 'tracked-ethereum-addresses');
      }));

      afterEach(teardown);

      it('can index address for a spend of ethers', async function () {
        const value = web3.toWei(txnTestEthValue, 'ether');
        const { from, to, txn: setupTxn } = await setupTrackedAddresses(accounts[0], web3.toWei(txnTestEthValueWithGasFee, 'ether'));

        let txnHash = await sendTransaction({ from, to, value, gasPrice });
        let txn = await getTransaction(txnHash);
        let block = await getBlock(txn.blockNumber);
        let senderBalance = await getBalance(from);

        await waitForEthereumEvents(transactionIndexer);
        let { data: sender } = await searchers.getFromControllingBranch(env.session, 'ethereum-addresses', from);

        expect(sender).has.deep.property('attributes.ethereum-address', web3.toChecksumAddress(from));
        expect(sender).has.deep.property('attributes.balance', senderBalance.toString());
        expect(sender.relationships.transactions.data).to.eql([
          { type: 'ethereum-transactions', id: setupTxn.hash },
          { type: 'ethereum-transactions', id: txn.hash }
        ]);
        expect(sender).to.not.have.deep.property('meta.loadingTransactions');
        expect(sender).to.not.have.deep.property('meta.loadingBlockheight');
        expect(sender).to.not.have.deep.property('meta.abortLoadingBlockheight');
        expect(sender).has.deep.property('meta.blockHeight', block.number);
        expect(sender).has.deep.property('meta.version', `${block.number}.0`);
        expect(sender).has.deep.property('meta.discoveredAtBlock', setupTxn.blockNumber);

        let { data: transaction } = await searchers.getFromControllingBranch(env.session, 'ethereum-transactions', txn.hash);
        await assertTxnResourceMatchesEthTxn(transaction, txn, block);
        expect(transaction.relationships['to-address'].data).to.eql({ type: 'ethereum-addresses', id: to });
        expect(transaction.relationships['from-address'].data).to.eql({ type: 'ethereum-addresses', id: from });
      });

      it('can index address for receipt of ethers', async function () {
        const value = web3.toWei(txnTestEthValue, 'ether');
        const { from, to, txn: setupTxn} = await setupTrackedAddresses(accounts[1], web3.toWei(txnTestEthValueWithGasFee, 'ether'));

        let txnHash = await sendTransaction({ from, to, value, gasPrice });
        let txn = await getTransaction(txnHash);
        let block = await getBlock(txn.blockNumber);
        let recipientBalance = await getBalance(to);

        await waitForEthereumEvents(transactionIndexer);
        let { data: recipient } = await searchers.getFromControllingBranch(env.session, 'ethereum-addresses', to);

        expect(recipient).has.deep.property('attributes.ethereum-address', web3.toChecksumAddress(to));
        expect(recipient).has.deep.property('attributes.balance', recipientBalance.toString());
        expect(recipient.relationships.transactions.data).to.eql([{ type: 'ethereum-transactions', id: txn.hash }]);
        expect(recipient).to.not.have.deep.property('meta.loadingTransactions');
        expect(recipient).to.not.have.deep.property('meta.loadingBlockheight');
        expect(recipient).to.not.have.deep.property('meta.abortLoadingBlockheight');
        expect(recipient).has.deep.property('meta.blockHeight', block.number);
        expect(recipient).has.deep.property('meta.version', `${block.number}.0`);
        expect(recipient).has.deep.property('meta.discoveredAtBlock', setupTxn.blockNumber);

        let { data: transaction } = await searchers.getFromControllingBranch(env.session, 'ethereum-transactions', txn.hash);
        await assertTxnResourceMatchesEthTxn(transaction, txn, block);
        expect(transaction.relationships['to-address'].data).to.eql({ type: 'ethereum-addresses', id: to });
        expect(transaction.relationships['from-address'].data).to.eql({ type: 'ethereum-addresses', id: from });
      });

      it('can represent multiple transactions for a sender`s address', async function () {
        const value = web3.toWei(txnTestEthValue, 'ether');
        const { from, to, txn: setupTxn } = await setupTrackedAddresses(accounts[2], web3.toWei(3 * txnTestEthValueWithGasFee, 'ether'));

        let txnHash = await sendTransaction({ from, to, value, gasPrice });
        let txn1 = await getTransaction(txnHash);

        txnHash = await sendTransaction({ from, to, value, gasPrice });
        let txn2 = await getTransaction(txnHash);

        txnHash = await sendTransaction({ from, to, value, gasPrice });
        let txn3 = await getTransaction(txnHash);
        let block = await getBlock(txn3.blockNumber);

        await waitForEthereumEvents(transactionIndexer);
        let { data: sender } = await searchers.getFromControllingBranch(env.session, 'ethereum-addresses', from);
        expect(sender.relationships.transactions.data).to.eql([
          { type: 'ethereum-transactions', id: setupTxn.hash },
          { type: 'ethereum-transactions', id: txn1.hash },
          { type: 'ethereum-transactions', id: txn2.hash },
          { type: 'ethereum-transactions', id: txn3.hash }
        ]);
        expect(sender).to.not.have.deep.property('meta.loadingTransactions');
        expect(sender).to.not.have.deep.property('meta.loadingBlockheight');
        expect(sender).to.not.have.deep.property('meta.abortLoadingBlockheight');
        expect(sender).has.deep.property('meta.blockHeight', block.number);
        expect(sender).has.deep.property('meta.version', `${block.number}.0`);
        expect(sender).has.deep.property('meta.discoveredAtBlock', setupTxn.blockNumber);
      });

      it('can represent multiple transactions for a recipient`s address', async function () {
        const value = web3.toWei(txnTestEthValue, 'ether');
        const { from, to, txn: setupTxn} = await setupTrackedAddresses(accounts[3], web3.toWei(3 * txnTestEthValueWithGasFee, 'ether'));

        let txnHash = await sendTransaction({ from, to, value, gasPrice });
        let txn1 = await getTransaction(txnHash);

        txnHash = await sendTransaction({ from, to, value, gasPrice });
        let txn2 = await getTransaction(txnHash);

        txnHash = await sendTransaction({ from, to, value, gasPrice });
        let txn3 = await getTransaction(txnHash);
        let block = await getBlock(txn3.blockNumber);

        await waitForEthereumEvents(transactionIndexer);
        let { data: recipient } = await searchers.getFromControllingBranch(env.session, 'ethereum-addresses', to);
        expect(recipient.relationships.transactions.data).to.eql([
          { type: 'ethereum-transactions', id: txn1.hash },
          { type: 'ethereum-transactions', id: txn2.hash },
          { type: 'ethereum-transactions', id: txn3.hash }
        ]);
        expect(recipient).to.not.have.deep.property('meta.loadingTransactions');
        expect(recipient).to.not.have.deep.property('meta.loadingBlockheight');
        expect(recipient).to.not.have.deep.property('meta.abortLoadingBlockheight');
        expect(recipient).has.deep.property('meta.blockHeight', block.number);
        expect(recipient).has.deep.property('meta.version', `${block.number}.0`);
        expect(recipient).has.deep.property('meta.discoveredAtBlock', setupTxn.blockNumber);
      });

      it('can index past transactions for an address that has sent ethers', async function () {
        const value = web3.toWei(txnTestEthValue, 'ether');
        const { address: sender, txn: setupTxn } = await newAddress(accounts[4], web3.toWei(3 * txnTestEthValueWithGasFee, 'ether'));
        const { address: recipient } = await newAddress();

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
        expect(senderDoc).to.not.have.deep.property('meta.loadingBlockheight');
        expect(senderDoc).to.not.have.deep.property('meta.abortLoadingBlockheight');
        expect(senderDoc).has.deep.property('meta.blockHeight', block3.number);
        expect(senderDoc).has.deep.property('meta.version', `${block3.number}.0`);
        expect(senderDoc).has.deep.property('meta.discoveredAtBlock', setupTxn.blockNumber);
        expect(senderDoc.relationships.transactions.data).to.eql([
          { type: 'ethereum-transactions', id: setupTxn.hash },
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
        const value = web3.toWei(txnTestEthValue, 'ether');
        const { address: sender } = await newAddress(accounts[5], web3.toWei(3 * txnTestEthValueWithGasFee, 'ether'));
        const { address: recipient } = await newAddress();

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
        expect(recipientDoc).to.not.have.deep.property('meta.loadingBlockheight');
        expect(recipientDoc).to.not.have.deep.property('meta.abortLoadingBlockheight');
        expect(recipientDoc).has.deep.property('meta.blockHeight', block3.number);
        expect(recipientDoc).has.deep.property('meta.version', `${block3.number}.0`);
        expect(recipientDoc).has.deep.property('meta.discoveredAtBlock', txn1.blockNumber);
        expect(recipientDoc.relationships.transactions.data).to.eql([
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
        const value = web3.toWei(txnTestEthValue, 'ether');
        const { address: addressX } = await newAddress(accounts[6], web3.toWei(2 * txnTestEthValueWithGasFee, 'ether'));
        const { address: addressY, txn: setupTxn} = await newAddress(accounts[7], web3.toWei(txnTestEthValueWithGasFee, 'ether'));

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
        expect(recipientDoc).to.not.have.deep.property('meta.loadingBlockheight');
        expect(recipientDoc).to.not.have.deep.property('meta.abortLoadingBlockheight');
        expect(recipientDoc).has.deep.property('meta.blockHeight', block3.number);
        expect(recipientDoc).has.deep.property('meta.version', `${block3.number}.0`);
        expect(recipientDoc).has.deep.property('meta.discoveredAtBlock', setupTxn.blockNumber);
        expect(recipientDoc.relationships.transactions.data).to.eql([
          { type: 'ethereum-transactions', id: setupTxn.hash },
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
        const value = web3.toWei(txnTestEthValue, 'ether');
        const { address: sender } = await newAddress(accounts[8], web3.toWei(txnTestEthValueWithGasFee, 'ether'));
        const { address: recipient } = await newAddress();
        await waitForEthereumEvents(transactionIndexer);

        let { data: { meta: { version } } } = await createTrackedEthereumAddress(sender);
        let txnHash = await sendTransaction({ from: sender, to: recipient, value, gasPrice });
        let txn = await getTransaction(txnHash);
        await waitForEthereumEvents(transactionIndexer);

        await searchers.getFromControllingBranch(env.session, 'ethereum-transactions', txn.hash);
        await env.lookup('hub:writers').delete('master', env.session, version, 'tracked-ethereum-addresses', sender);
        await waitForEthereumEvents(transactionIndexer);

        let error = null;
        try {
          await searchers.getFromControllingBranch(env.session, 'ethereum-addresses', sender);
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
        const value = web3.toWei(txnTestEthValue, 'ether');
        const { address: sender } = await newAddress(accounts[9], web3.toWei(txnTestEthValueWithGasFee, 'ether'));
        const { address: recipient } = await newAddress();
        await waitForEthereumEvents(transactionIndexer);

        let { data: { meta: { version } } } = await createTrackedEthereumAddress(sender);
        await createTrackedEthereumAddress(recipient);

        let txnHash = await sendTransaction({ from: sender, to: recipient, value, gasPrice });
        let txn = await getTransaction(txnHash);
        let block = await getBlock(txn.blockNumber);
        await waitForEthereumEvents(transactionIndexer);

        await searchers.getFromControllingBranch(env.session, 'ethereum-transactions', txn.hash);
        await env.lookup('hub:writers').delete('master', env.session, version, 'tracked-ethereum-addresses', sender);
        await waitForEthereumEvents(transactionIndexer);

        let error = null;
        try {
          await searchers.getFromControllingBranch(env.session, 'ethereum-addresses', sender);
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
        const value = web3.toWei(txnTestEthValue, 'ether');
        const { from, to, txn: setupTxn } = await setupTrackedAddresses(accounts[0], web3.toWei(4 * txnTestEthValueWithGasFee, 'ether'));
        const { address: ignoredSender } = await newAddress(accounts[1], web3.toWei(txnTestEthValueWithGasFee, 'ether'));
        const { address: ignoredRecipient } = await newAddress();

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
        expect(sender.relationships.transactions.data).to.eql([
          { type: 'ethereum-transactions', id: setupTxn.hash },
          { type: 'ethereum-transactions', id: txn1.hash },
          { type: 'ethereum-transactions', id: txn2.hash },
          { type: 'ethereum-transactions', id: txn3.hash }
        ]);
        expect(sender).to.not.have.deep.property('meta.loadingTransactions');
        expect(sender).to.not.have.deep.property('meta.loadingBlockheight');
        expect(sender).to.not.have.deep.property('meta.abortLoadingBlockheight');
        expect(sender).has.deep.property('meta.blockHeight', block3.number);
        expect(sender).has.deep.property('meta.version', `${block3.number}.0`);
        expect(sender).has.deep.property('meta.discoveredAtBlock', setupTxn.blockNumber);

        let { data: recipient } = await searchers.getFromControllingBranch(env.session, 'ethereum-addresses', to);
        expect(recipient).has.deep.property('attributes.balance', recipientBalance.toString());
        expect(recipient.relationships.transactions.data).to.eql([
          { type: 'ethereum-transactions', id: txn1.hash },
          { type: 'ethereum-transactions', id: txn2.hash },
          { type: 'ethereum-transactions', id: txn3.hash }
        ]);
        expect(recipient).to.not.have.deep.property('meta.loadingTransactions');
        expect(recipient).to.not.have.deep.property('meta.loadingBlockheight');
        expect(recipient).to.not.have.deep.property('meta.abortLoadingBlockheight');
        expect(recipient).has.deep.property('meta.blockHeight', block3.number);
        expect(recipient).has.deep.property('meta.version', `${block3.number}.0`);
        expect(recipient).has.deep.property('meta.discoveredAtBlock', setupTxn.blockNumber);

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
        expect(senderUpdated.relationships.transactions.data).to.eql([
          { type: 'ethereum-transactions', id: setupTxn.hash },
          { type: 'ethereum-transactions', id: txn1.hash },
          { type: 'ethereum-transactions', id: txn2.hash },
          { type: 'ethereum-transactions', id: txn3.hash },
          { type: 'ethereum-transactions', id: txn4.hash }
        ]);
        expect(senderUpdated).to.not.have.deep.property('meta.loadingTransactions');
        expect(senderUpdated).to.not.have.deep.property('meta.loadingBlockheight');
        expect(senderUpdated).to.not.have.deep.property('meta.abortLoadingBlockheight');
        expect(senderUpdated).has.deep.property('meta.blockHeight', block4.number);
        expect(senderUpdated).has.deep.property('meta.version', `${block4.number}.0`);
        expect(senderUpdated).has.deep.property('meta.discoveredAtBlock', setupTxn.blockNumber);

        let { data: recipientUpdated } = await searchers.getFromControllingBranch(env.session, 'ethereum-addresses', to);
        expect(recipientUpdated).has.deep.property('attributes.balance', recipientBalance.toString());
        expect(recipientUpdated.relationships.transactions.data).to.eql([
          { type: 'ethereum-transactions', id: txn1.hash },
          { type: 'ethereum-transactions', id: txn2.hash },
          { type: 'ethereum-transactions', id: txn3.hash },
          { type: 'ethereum-transactions', id: txn4.hash }
        ]);
        expect(recipientUpdated).to.not.have.deep.property('meta.loadingTransactions');
        expect(recipientUpdated).to.not.have.deep.property('meta.loadingBlockheight');
        expect(recipientUpdated).to.not.have.deep.property('meta.abortLoadingBlockheight');
        expect(recipientUpdated).has.deep.property('meta.blockHeight', block4.number);
        expect(recipientUpdated).has.deep.property('meta.version', `${block4.number}.0`);
        expect(recipientUpdated).has.deep.property('meta.discoveredAtBlock', setupTxn.blockNumber);

        let { data: transaction4 } = await searchers.getFromControllingBranch(env.session, 'ethereum-transactions', txn4.hash);
        await assertTxnResourceMatchesEthTxn(transaction4, txn4, block4);
        expect(transaction4.relationships['to-address'].data).to.eql({ type: 'ethereum-addresses', id: to });
        expect(transaction4.relationships['from-address'].data).to.eql({ type: 'ethereum-addresses', id: from });
      });

      it('can rebuild ethereum-addresses and ethereum-transaction records if the tracked addresses are not in the index', async function () {
        const pgclient = await env.lookup(`plugin-client:${require.resolve('@cardstack/pgsearch/client')}`);
        const value = web3.toWei(txnTestEthValue, 'ether');
        const { from, to, txn: setupTxn } = await setupTrackedAddresses(accounts[4], web3.toWei(3 * txnTestEthValueWithGasFee, 'ether'));

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
          } catch (e) {
            error = e;
          }
          expect(error.status).to.equal(404);
        }
        for (let id of [setupTxn.hash, txn1.hash, txn2.hash, txn3.hash]) {
          await pgclient.query(sql, ['master', 'ethereum-transactions', id]);

          let error;
          try {
            await searchers.getFromControllingBranch(env.session, 'ethereum-transactions', id);
          } catch (e) {
            error = e;
          }
          expect(error.status).to.equal(404);
        }

        await env.lookup('hub:indexers').update({ forceRefresh: true });
        await waitForEthereumEvents(transactionIndexer);

        let { data: sender } = await searchers.getFromControllingBranch(env.session, 'ethereum-addresses', from);
        expect(sender).has.deep.property('attributes.balance', senderBalance.toString());
        expect(sender.relationships.transactions.data).to.eql([
          { type: 'ethereum-transactions', id: setupTxn.hash },
          { type: 'ethereum-transactions', id: txn1.hash },
          { type: 'ethereum-transactions', id: txn2.hash },
          { type: 'ethereum-transactions', id: txn3.hash }
        ]);
        expect(sender).to.not.have.deep.property('meta.loadingTransactions');
        expect(sender).to.not.have.deep.property('meta.loadingBlockheight');
        expect(sender).to.not.have.deep.property('meta.abortLoadingBlockheight');
        expect(sender).has.deep.property('meta.blockHeight', block3.number);
        expect(sender).has.deep.property('meta.version', `${block3.number}.0`);
        expect(sender).has.deep.property('meta.discoveredAtBlock', setupTxn.blockNumber);

        let { data: recipient } = await searchers.getFromControllingBranch(env.session, 'ethereum-addresses', to);
        expect(recipient).has.deep.property('attributes.balance', recipientBalance.toString());
        expect(recipient.relationships.transactions.data).to.eql([
          { type: 'ethereum-transactions', id: txn1.hash },
          { type: 'ethereum-transactions', id: txn2.hash },
          { type: 'ethereum-transactions', id: txn3.hash }
        ]);
        expect(recipient).to.not.have.deep.property('meta.loadingTransactions');
        expect(sender).to.not.have.deep.property('meta.loadingBlockheight');
        expect(sender).to.not.have.deep.property('meta.abortLoadingBlockheight');
        expect(recipient).has.deep.property('meta.blockHeight', block3.number);
        expect(recipient).has.deep.property('meta.version', `${block3.number}.0`);
        expect(recipient).has.deep.property('meta.discoveredAtBlock', txn1.blockNumber);

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
        const value = web3.toWei(txnTestEthValue, 'ether');
        const { from, txn: setupTxn } = await setupTrackedAddresses(accounts[7], web3.toWei(txnTestEthValueWithGasFee, 'ether'));

        let txnHash = await sendTransaction({ from, to: from, value, gasPrice });
        let txn = await getTransaction(txnHash);
        let block = await getBlock(txn.blockNumber);
        let senderBalance = await getBalance(from);

        await waitForEthereumEvents(transactionIndexer);
        let { data: sender } = await searchers.getFromControllingBranch(env.session, 'ethereum-addresses', from);

        expect(sender).has.deep.property('attributes.ethereum-address', web3.toChecksumAddress(from));
        expect(sender).has.deep.property('attributes.balance', senderBalance.toString());
        expect(sender.relationships.transactions.data).to.eql([
          { type: 'ethereum-transactions', id: setupTxn.hash },
          { type: 'ethereum-transactions', id: txn.hash }
        ]);
        expect(sender).to.not.have.deep.property('meta.loadingTransactions');
        expect(sender).to.not.have.deep.property('meta.loadingBlockheight');
        expect(sender).to.not.have.deep.property('meta.abortLoadingBlockheight');
        expect(sender).has.deep.property('meta.blockHeight', block.number);
        expect(sender).has.deep.property('meta.version', `${block.number}.0`);
        expect(sender).has.deep.property('meta.discoveredAtBlock', setupTxn.blockNumber);

        let { data: transaction } = await searchers.getFromControllingBranch(env.session, 'ethereum-transactions', txn.hash);
        await assertTxnResourceMatchesEthTxn(transaction, txn, block);
        expect(transaction.relationships['to-address'].data).to.eql({ type: 'ethereum-addresses', id: from });
        expect(transaction.relationships['from-address'].data).to.eql({ type: 'ethereum-addresses', id: from });
      });

      it('can index a past transaction where the sender and receiver are the same address', async function () {
        const value = web3.toWei(txnTestEthValue, 'ether');
        const { address: sender, txn: setupTxn } = await newAddress(accounts[8], web3.toWei(txnTestEthValueWithGasFee, 'ether'));

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
        expect(senderDoc).to.not.have.deep.property('meta.loadingBlockheight');
        expect(senderDoc).to.not.have.deep.property('meta.abortLoadingBlockheight');
        expect(senderDoc).has.deep.property('meta.blockHeight', block.number);
        expect(senderDoc).has.deep.property('meta.version', `${block.number}.0`);
        expect(senderDoc).has.deep.property('meta.discoveredAtBlock', setupTxn.blockNumber);
        expect(senderDoc.relationships.transactions.data).to.eql([
          { type: 'ethereum-transactions', id: setupTxn.hash },
          { type: 'ethereum-transactions', id: txn.hash }
        ]);

        let { data: transaction } = await searchers.getFromControllingBranch(env.session, 'ethereum-transactions', txn.hash);
        await assertTxnResourceMatchesEthTxn(transaction, txn, block);
        expect(transaction.relationships['to-address'].data).to.eql({ type: 'ethereum-addresses', id: sender });
        expect(transaction.relationships['from-address'].data).to.eql({ type: 'ethereum-addresses', id: sender });
      });

      it('can index a tracked address that has no transactions', async function () {
        const trackedAddress = await newAccount();
        let block = await getBlock('latest');

        await createTrackedEthereumAddress(trackedAddress);

        let { data: addressDoc } = await searchers.getFromControllingBranch(env.session, 'ethereum-addresses', trackedAddress);

        expect(addressDoc).has.deep.property('attributes.ethereum-address', web3.toChecksumAddress(trackedAddress));
        expect(addressDoc).has.deep.property('attributes.balance', '0');
        expect(addressDoc).to.not.have.deep.property('meta.loadingTransactions');
        expect(addressDoc).to.not.have.deep.property('meta.loadingBlockheight');
        expect(addressDoc).to.not.have.deep.property('meta.abortLoadingBlockheight');
        expect(addressDoc).has.deep.property('meta.blockHeight', block.number);
        expect(addressDoc).has.deep.property('meta.version', '0.0');
        expect(addressDoc).has.deep.property('meta.discoveredAtBlock', block.number);
        expect(addressDoc.relationships.transactions.data).to.eql([]);
      });

      // This asserts that the promise chaining in the TransactonIndexer.index() is chaining the index requests appropriately
      it('can index a newly added tracked address that immediately appears in a mined block', async function () {
        const value = web3.toWei(txnTestEthValue, 'ether');
        const { address: sender, txn: setupTxn } = await newAddress(accounts[9], web3.toWei(2 * txnTestEthValueWithGasFee, 'ether'));
        const { address: recipient } = await newAddress();

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
        expect(senderDoc.relationships.transactions.data).to.eql([
          { type: 'ethereum-transactions', id: setupTxn.hash },
          { type: 'ethereum-transactions', id: txn1.hash },
          { type: 'ethereum-transactions', id: txn2.hash },
        ]);
        expect(senderDoc).to.not.have.deep.property('meta.loadingTransactions');
        expect(senderDoc).to.not.have.deep.property('meta.loadingBlockheight');
        expect(senderDoc).to.not.have.deep.property('meta.abortLoadingBlockheight');
        expect(senderDoc).has.deep.property('meta.blockHeight', block2.number);
        expect(senderDoc).has.deep.property('meta.version', `${block2.number}.0`);
        expect(senderDoc).has.deep.property('meta.discoveredAtBlock', setupTxn.blockNumber);
      });

      it('can resume indexing a new address after its indexing has been interrupted', async function() {
        const value = web3.toWei(txnTestEthValue, 'ether');
        const { address: sender, txn: setupTxn } = await newAddress(accounts[3], web3.toWei(3 * txnTestEthValueWithGasFee, 'ether'));
        const { address: recipient } = await newAddress();

        let txnHash = await sendTransaction({ from: sender, to: recipient, value: web3.toWei(txnTestEthValueWithGasFee, 'ether'), gasPrice });
        let txn1 = await getTransaction(txnHash);
        let block1 = await getBlock(txn1.blockNumber);

        txnHash = await sendTransaction({ from: sender, to: recipient, value, gasPrice });
        let txn2 = await getTransaction(txnHash);
        let block2 = await getBlock(txn2.blockNumber);

        txnHash = await sendTransaction({ from: sender, to: recipient, value, gasPrice });
        let txn3 = await getTransaction(txnHash);
        let block3 = await getBlock(txn3.blockNumber);

        let senderBalance = await getBalance(sender);

        await env.lookup('hub:indexers').update({ forceRefresh: true });
        await waitForEthereumEvents(transactionIndexer);

        // manufacture an ethereum-address whose meta.loadingTransactions is true directly in the index
        // this should be what an interrupted indexing attempt should look like, as at the conclusion of
        // each indexing job, the meta.loadingTransactions is removed
        let pgsearchClient = env.lookup(`plugin-services:${require.resolve('@cardstack/pgsearch/client')}`);
        await pgsearchClient.ensureDatabaseSetup();
        let currentSchema = env.lookup('hub:current-schema');
        let schema = await currentSchema.forBranch('master');
        let batch = pgsearchClient.beginBatch(schema, searchers);
        let interruptedAddressDoc = {
          data: {
            type: 'ethereum-addresses',
            id: sender.toLowerCase(),
            meta: {
              blockheight: block3.number,
              version: 0.0,
              loadingTransactions: true
            }
          },
        };
        let { data: { id, type} } = interruptedAddressDoc;
        let documentContext = searchers.createDocumentContext({
          id,
          type,
          branch: 'master',
          schema,
          sourceId: 'ethereum-addresses',
          upstreamDoc: interruptedAddressDoc
        });
        await batch.saveDocument(await documentContext);
        let trackingAddressDoc = { data: { id, type: 'tracked-ethereum-addresses' } };
        documentContext = searchers.createDocumentContext({
          id,
          type: 'tracked-ethereum-addresses',
          branch: 'master',
          schema,
          sourceId: 'default-data-source',
          upstreamDoc: trackingAddressDoc
        });
        await batch.saveDocument(await documentContext);
        await batch.done();

        await env.lookup('hub:indexers').update({ forceRefresh: true });
        await waitForEthereumEvents(transactionIndexer);

        let { data: senderDoc } = await searchers.getFromControllingBranch(env.session, 'ethereum-addresses', sender);

        expect(senderDoc).has.deep.property('attributes.ethereum-address', web3.toChecksumAddress(sender));
        expect(senderDoc).has.deep.property('attributes.balance', senderBalance.toString());
        expect(senderDoc).to.not.have.deep.property('meta.loadingTransactions');
        expect(senderDoc).to.not.have.deep.property('meta.loadingBlockheight');
        expect(senderDoc).to.not.have.deep.property('meta.abortLoadingBlockheight');
        expect(senderDoc).has.deep.property('meta.blockHeight', block3.number);
        expect(senderDoc).has.deep.property('meta.version', `${block3.number}.0`);
        expect(senderDoc).has.deep.property('meta.discoveredAtBlock', setupTxn.blockNumber);
        expect(senderDoc.relationships.transactions.data).to.eql([
          { type: 'ethereum-transactions', id: setupTxn.hash },
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

      it('can index tracked address whose transaction is present in a block that was mined before the lowest indexed blockheight', async function() {
        const value = web3.toWei(txnTestEthValue, 'ether');
        const { address: sender, txn: setupTxn } = await newAddress(accounts[4], web3.toWei(2 * txnTestEthValueWithGasFee, 'ether'));
        const { address: recipient1 } = await newAddress();
        const { address: recipient2 } = await newAddress();

        let txnHash = await sendTransaction({ from: sender, to: recipient1, value: web3.toWei(txnTestEthValueWithGasFee, 'ether'), gasPrice });
        let txn1 = await getTransaction(txnHash);
        let block1 = await getBlock(txn1.blockNumber);

        txnHash = await sendTransaction({ from: recipient1, to: recipient2, value, gasPrice });
        let txn2 = await getTransaction(txnHash);
        let block2 = await getBlock(txn2.blockNumber);

        let senderBalance = await getBalance(sender);

        await waitForEthereumEvents(transactionIndexer);
        await createTrackedEthereumAddress(recipient2);

        let error = null;
        try {
          await searchers.getFromControllingBranch(env.session, 'ethereum-addresses', sender);
        } catch (e) {
          error = e;
        }
        expect(error.status).to.equal(404);

        let { data: blocks1 } = await searchers.searchFromControllingBranch(env.session, {
          filter: {
            type: { exact: 'blocks' }
          },
          sort: 'block-number',
          page: { size: 1 }
        });

        expect(blocks1[0]).to.have.property('id', block2.number);

        await createTrackedEthereumAddress(sender);

        let { data: senderDoc } = await searchers.getFromControllingBranch(env.session, 'ethereum-addresses', sender);

        expect(senderDoc).has.deep.property('attributes.ethereum-address', web3.toChecksumAddress(sender));
        expect(senderDoc).has.deep.property('attributes.balance', senderBalance.toString());
        expect(senderDoc.relationships.transactions.data).to.eql([
          { type: 'ethereum-transactions', id: setupTxn.hash },
          { type: 'ethereum-transactions', id: txn1.hash }
        ]);
        expect(senderDoc).to.not.have.deep.property('meta.loadingTransactions');
        expect(senderDoc).to.not.have.deep.property('meta.loadingBlockheight');
        expect(senderDoc).to.not.have.deep.property('meta.abortLoadingBlockheight');
        expect(senderDoc).has.deep.property('meta.blockHeight', block2.number);
        expect(senderDoc).has.deep.property('meta.version', `${block1.number}.0`);
        expect(senderDoc).has.deep.property('meta.discoveredAtBlock', setupTxn.blockNumber);

        let { data: transaction } = await searchers.getFromControllingBranch(env.session, 'ethereum-transactions', txn1.hash);
        await assertTxnResourceMatchesEthTxn(transaction, txn1, block1);
        expect(transaction.relationships['from-address'].data).to.eql({ type: 'ethereum-addresses', id: sender });
        expect(transaction.relationships['to-address'].data).to.eql({ type: 'ethereum-addresses', id: recipient1 });

        let { data: blocks2 } = await searchers.searchFromControllingBranch(env.session, {
          filter: {
            type: { exact: 'blocks' }
          },
          sort: 'block-number',
          page: { size: 1 }
        });

        expect(blocks2[0]).to.have.property('id', setupTxn.blockNumber);
      });
    });

    describe('using tracked address model as an attribute that holds a string array', function () {
      beforeEach(setup(factory => {
        factory.addResource('data-sources', 'etherem-addresses')
          .withAttributes({
            'source-type': '@cardstack/ethereum',
            params: {
              jsonRpcUrl: "ws://localhost:7545",
              addressIndexing: {
                trackedAddressContentType: 'tracked-ethereum-addresses',
                trackedAddressField: 'tracked-addresses',
                maxAddressesTracked: 100
              }
            },
          });

        factory.addResource('content-types', 'tracked-ethereum-addresses')
          .withRelated('fields', [
            factory.addResource('fields', 'tracked-addresses').withAttributes({
              fieldType: '@cardstack/core-types::string-array'
            })
          ]);
      }));

      afterEach(teardown);

      it('ignores tracked address fields that are null', async function() {
        const value = web3.toWei(txnTestEthValue, 'ether');
        const { address: from } = await newAddress(accounts[1], web3.toWei(txnTestEthValueWithGasFee, 'ether'));
        const { address: to } = await newAddress();

        await env.lookup('hub:writers').create('master', env.session, 'tracked-ethereum-addresses', {
          data: { type: 'tracked-ethereum-addresses' }
        });
        await waitForEthereumEvents(transactionIndexer);

        await sendTransaction({ from, to, value, gasPrice });
        await waitForEthereumEvents(transactionIndexer);

        let { data: indexedAddresses } = await searchers.searchFromControllingBranch(env.session, {
          filter: { type: { exact: 'ethereum-addresses' } }
        });
        let { data: indexedTransactions } = await searchers.searchFromControllingBranch(env.session, {
          filter: { type: { exact: 'ethereum-transactions' } }
        });

        expect(indexedAddresses.length).to.equal(0);
        expect(indexedTransactions.length).to.equal(0);
      });

      it('can index tracked ethereum addresses where the field is an array of addresses to track', async function () {
        const value = web3.toWei(txnTestEthValue, 'ether');
        const { address: from } = await newAddress();
        const { address: to } = await newAddress();
        await createTrackedEthereumAddresses([ from, to ]);

        const setupTxn = await fundAddress(accounts[0], from, web3.toWei(txnTestEthValueWithGasFee, 'ether'));

        let txnHash = await sendTransaction({ from, to, value, gasPrice });
        let txn = await getTransaction(txnHash);
        let block = await getBlock(txn.blockNumber);
        let senderBalance = await getBalance(from);
        let recipientBalance = await getBalance(to);

        await waitForEthereumEvents(transactionIndexer);
        let { data: sender } = await searchers.getFromControllingBranch(env.session, 'ethereum-addresses', from);

        expect(sender).has.deep.property('attributes.ethereum-address', web3.toChecksumAddress(from));
        expect(sender).has.deep.property('attributes.balance', senderBalance.toString());
        expect(sender.relationships.transactions.data).to.eql([
          { type: 'ethereum-transactions', id: setupTxn.hash },
          { type: 'ethereum-transactions', id: txn.hash }
        ]);
        expect(sender).to.not.have.deep.property('meta.loadingTransactions');
        expect(sender).to.not.have.deep.property('meta.loadingBlockheight');
        expect(sender).to.not.have.deep.property('meta.abortLoadingBlockheight');
        expect(sender).has.deep.property('meta.blockHeight', block.number);
        expect(sender).has.deep.property('meta.version', `${block.number}.0`);
        expect(sender).has.deep.property('meta.discoveredAtBlock', setupTxn.blockNumber - 1); // in this case we start tacking the address one block before funds are deposited

        let { data: recipient } = await searchers.getFromControllingBranch(env.session, 'ethereum-addresses', to);

        expect(recipient).has.deep.property('attributes.ethereum-address', web3.toChecksumAddress(to));
        expect(recipient).has.deep.property('attributes.balance', recipientBalance.toString());
        expect(recipient.relationships.transactions.data).to.eql([{ type: 'ethereum-transactions', id: txn.hash }]);
        expect(recipient).to.not.have.deep.property('meta.loadingTransactions');
        expect(recipient).to.not.have.deep.property('meta.loadingBlockheight');
        expect(recipient).to.not.have.deep.property('meta.abortLoadingBlockheight');
        expect(recipient).has.deep.property('meta.blockHeight', block.number);
        expect(recipient).has.deep.property('meta.version', `${block.number}.0`);
        expect(recipient).has.deep.property('meta.discoveredAtBlock', setupTxn.blockNumber - 1); // in this case we start tacking the address one block before funds are deposited

        let { data: transaction } = await searchers.getFromControllingBranch(env.session, 'ethereum-transactions', txn.hash);
        await assertTxnResourceMatchesEthTxn(transaction, txn, block);
        expect(transaction.relationships['to-address'].data).to.eql({ type: 'ethereum-addresses', id: to });
        expect(transaction.relationships['from-address'].data).to.eql({ type: 'ethereum-addresses', id: from });
      });

      it('can index tracked ethereum addresses where the field is an array of addresses to track for past events', async function () {
        const value = web3.toWei(txnTestEthValue, 'ether');
        const { address: sender, txn: setupTxn } = await newAddress(accounts[1], web3.toWei(3 * txnTestEthValueWithGasFee, 'ether'));
        const { address: recipient } = await newAddress();

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
        let recipientBalance = await getBalance(recipient);

        await waitForEthereumEvents(transactionIndexer);

        await createTrackedEthereumAddresses([ sender, recipient ]);

        let { data: senderDoc } = await searchers.getFromControllingBranch(env.session, 'ethereum-addresses', sender);

        expect(senderDoc).has.deep.property('attributes.ethereum-address', web3.toChecksumAddress(sender));
        expect(senderDoc).has.deep.property('attributes.balance', senderBalance.toString());
        expect(senderDoc).to.not.have.deep.property('meta.loadingTransactions');
        expect(senderDoc).to.not.have.deep.property('meta.loadingBlockheight');
        expect(senderDoc).to.not.have.deep.property('meta.abortLoadingBlockheight');
        expect(senderDoc).has.deep.property('meta.blockHeight', block3.number);
        expect(senderDoc).has.deep.property('meta.version', `${block3.number}.0`);
        expect(senderDoc).has.deep.property('meta.discoveredAtBlock', setupTxn.blockNumber);
        expect(senderDoc.relationships.transactions.data).to.eql([
          { type: 'ethereum-transactions', id: setupTxn.hash },
          { type: 'ethereum-transactions', id: txn1.hash },
          { type: 'ethereum-transactions', id: txn2.hash },
          { type: 'ethereum-transactions', id: txn3.hash }
        ]);

        let { data: recipientDoc } = await searchers.getFromControllingBranch(env.session, 'ethereum-addresses', recipient);

        expect(recipientDoc).has.deep.property('attributes.ethereum-address', web3.toChecksumAddress(recipient));
        expect(recipientDoc).has.deep.property('attributes.balance', recipientBalance.toString());
        expect(recipientDoc).to.not.have.deep.property('meta.loadingTransactions');
        expect(recipientDoc).to.not.have.deep.property('meta.loadingBlockheight');
        expect(recipientDoc).to.not.have.deep.property('meta.abortLoadingBlockheight');
        expect(recipientDoc).has.deep.property('meta.blockHeight', block3.number);
        expect(recipientDoc).has.deep.property('meta.version', `${block3.number}.0`);
        expect(recipientDoc).has.deep.property('meta.discoveredAtBlock', txn1.blockNumber);
        expect(recipientDoc.relationships.transactions.data).to.eql([
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

      it('can stop indexing tracked ethereum addresses where the field is an array of addresses to track', async function () {
        const value = web3.toWei(txnTestEthValue, 'ether');
        const { address: sender, txn: setupTxn } = await newAddress(accounts[2], web3.toWei(txnTestEthValueWithGasFee, 'ether'));
        const { address: recipient } = await newAddress();

        let { data: { id, meta: { version } } } = await createTrackedEthereumAddresses([ sender, recipient ]);

        let txnHash = await sendTransaction({ from: sender, to: recipient, value, gasPrice });
        let txn = await getTransaction(txnHash);

        await waitForEthereumEvents(transactionIndexer);

        await searchers.getFromControllingBranch(env.session, 'ethereum-transactions', txn.hash);
        await env.lookup('hub:writers').delete('master', env.session, version, 'tracked-ethereum-addresses', id);

        await waitForEthereumEvents(transactionIndexer);

        let error = null;
        try {
          await searchers.getFromControllingBranch(env.session, 'ethereum-addresses', sender);
        } catch (e) {
          error = e;
        }
        expect(error.status).to.equal(404);

        error = null;
        try {
          await searchers.getFromControllingBranch(env.session, 'ethereum-addresses', recipient);
        } catch (e) {
          error = e;
        }
        expect(error.status).to.equal(404);

        error = null;
        try {
          await searchers.getFromControllingBranch(env.session, 'ethereum-transactions', setupTxn.hash);
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

      it('can stop indexing tracked ethereum addresses where the field is an array of addresses to track and addresses are being tracked multiple times', async function () {
        const value = web3.toWei(txnTestEthValue, 'ether');
        const { address: sender, txn: setupTxn } = await newAddress(accounts[3], web3.toWei(txnTestEthValueWithGasFee, 'ether'));
        const { address: recipient } = await newAddress();
        const { address: from } = await newAddress(accounts[4], web3.toWei(txnTestEthValueWithGasFee, 'ether'));
        const { address: to } = await newAddress();

        let { data: { id, meta: { version } } } = await createTrackedEthereumAddresses([ sender, recipient ]);
        await createTrackedEthereumAddresses([ recipient, to, from ]); // only the sender address will be fully dereferenced after the delete

        let txnHash = await sendTransaction({ from: sender, to: recipient, value, gasPrice });
        let txn = await getTransaction(txnHash);
        let block = await getBlock(txn.blockNumber);

        await waitForEthereumEvents(transactionIndexer);

        await searchers.getFromControllingBranch(env.session, 'ethereum-transactions', txn.hash);
        await env.lookup('hub:writers').delete('master', env.session, version, 'tracked-ethereum-addresses', id);

        await waitForEthereumEvents(transactionIndexer);

        let error = null;
        try {
          await searchers.getFromControllingBranch(env.session, 'ethereum-addresses', sender);
        } catch (e) {
          error = e;
        }
        expect(error.status).to.equal(404);

        error = null;
        try {
          await searchers.getFromControllingBranch(env.session, 'ethereum-transactions', setupTxn.hash);
        } catch (e) {
          error = e;
        }
        expect(error.status).to.equal(404);

        // this should not error
        await searchers.getFromControllingBranch(env.session, 'ethereum-addresses', recipient);

        let { data: transaction } = await searchers.getFromControllingBranch(env.session, 'ethereum-transactions', txn.hash);
        await assertTxnResourceMatchesEthTxn(transaction, txn, block);
        expect(transaction.relationships['to-address'].data).to.eql({ type: 'ethereum-addresses', id: recipient });
        expect(transaction.relationships['from-address'].data).to.eql({ type: 'ethereum-addresses', id: sender });
      });
    });

    describe('using a max depth', function () {
      beforeEach(setup(factory => {
        factory.addResource('data-sources', 'etherem-addresses')
          .withAttributes({
            'source-type': '@cardstack/ethereum',
            params: {
              jsonRpcUrl: "ws://localhost:7545",
              addressIndexing: {
                trackedAddressContentType: 'tracked-ethereum-addresses',
                trackedAddressField: 'id',
                maxAddressesTracked: 100,
                maxBlockSearchDepth: 2
              }
            },
          });

        factory.addResource('content-types', 'tracked-ethereum-addresses');
      }));

      afterEach(teardown);

      it('can abort indexing past transactions for an address when the maxBlockSearchDepth has been reached', async function () {
        const value = web3.toWei(txnTestEthValue, 'ether');
        const { address: sender } = await newAddress(accounts[4], web3.toWei(3 * txnTestEthValueWithGasFee, 'ether'));
        const { address: recipient } = await newAddress();

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
        expect(senderDoc).to.not.have.deep.property('meta.loadingBlockheight');
        expect(senderDoc).has.deep.property('meta.abortLoadingBlockheight', block1.number);
        expect(senderDoc).has.deep.property('meta.blockHeight', block3.number);
        expect(senderDoc).has.deep.property('meta.version', `${block3.number}.0`);
        expect(senderDoc).has.deep.property('meta.discoveredAtBlock', block2.number);
        expect(senderDoc.relationships.transactions.data).to.eql([
          { type: 'ethereum-transactions', id: txn2.hash },
          { type: 'ethereum-transactions', id: txn3.hash }
        ]);

        let error;
        try {
          await searchers.getFromControllingBranch(env.session, 'ethereum-transactions', txn1.hash);
        } catch (e) {
          error = e;
        }
        expect(error.status).to.equal(404);

        let { data: transaction2 } = await searchers.getFromControllingBranch(env.session, 'ethereum-transactions', txn2.hash);
        await assertTxnResourceMatchesEthTxn(transaction2, txn2, block2);
        expect(transaction2.relationships['to-address'].data).to.eql({ type: 'ethereum-addresses', id: recipient });
        expect(transaction2.relationships['from-address'].data).to.eql({ type: 'ethereum-addresses', id: sender });

        let { data: transaction3 } = await searchers.getFromControllingBranch(env.session, 'ethereum-transactions', txn3.hash);
        await assertTxnResourceMatchesEthTxn(transaction3, txn3, block3);
        expect(transaction3.relationships['to-address'].data).to.eql({ type: 'ethereum-addresses', id: recipient });
        expect(transaction3.relationships['from-address'].data).to.eql({ type: 'ethereum-addresses', id: sender });
      });

      // skipping this as it only works if we use an alernative means to get blocks (like ideally from the index)
      it.skip('can resume aborted address indexing', async function () {
        const value = web3.toWei(txnTestEthValue, 'ether');
        const { address: sender, txn: setupTxn } = await newAddress(accounts[4], web3.toWei(3 * txnTestEthValueWithGasFee, 'ether'));
        const { address: recipient } = await newAddress();

        let txnHash = await sendTransaction({ from: sender, to: recipient, value, gasPrice });
        let txn1 = await getTransaction(txnHash);
        await getBlock(txn1.blockNumber);

        txnHash = await sendTransaction({ from: sender, to: recipient, value, gasPrice });
        let txn2 = await getTransaction(txnHash);
        let block2 = await getBlock(txn2.blockNumber);

        txnHash = await sendTransaction({ from: sender, to: recipient, value, gasPrice });
        let txn3 = await getTransaction(txnHash);
        let block3 = await getBlock(txn3.blockNumber);
        let senderBalance = await getBalance(sender);

        await waitForEthereumEvents(transactionIndexer);
        await createTrackedEthereumAddress(sender);

        await env.lookup('hub:indexers').update({ forceRefresh: true });
        await waitForEthereumEvents(transactionIndexer);

        // it will take 2 indexing tries to index all the txns based on the max depth
        await env.lookup('hub:indexers').update({ forceRefresh: true });
        await waitForEthereumEvents(transactionIndexer);

        let { data: senderDoc } = await searchers.getFromControllingBranch(env.session, 'ethereum-addresses', sender);

        expect(senderDoc).has.deep.property('attributes.ethereum-address', web3.toChecksumAddress(sender));
        expect(senderDoc).has.deep.property('attributes.balance', senderBalance.toString());
        expect(senderDoc).to.not.have.deep.property('meta.loadingTransactions');
        expect(senderDoc).to.not.have.deep.property('meta.loadingBlockheight');
        expect(senderDoc).to.not.have.deep.property('meta.abortLoadingBlockheight');
        expect(senderDoc).has.deep.property('meta.blockHeight', block3.number);
        expect(senderDoc).has.deep.property('meta.version', `${block3.number}.0`);
        expect(senderDoc).has.deep.property('meta.discoveredAtBlock', setupTxn.blockNumber);
        expect(senderDoc.relationships.transactions.data).to.eql([
          { type: 'ethereum-transactions', id: setupTxn.hash },
          { type: 'ethereum-transactions', id: txn1.hash },
          { type: 'ethereum-transactions', id: txn2.hash },
          { type: 'ethereum-transactions', id: txn3.hash }
        ]);

        let { data: transaction1 } = await searchers.getFromControllingBranch(env.session, 'ethereum-transactions', txn1.hash);
        await assertTxnResourceMatchesEthTxn(transaction1, txn1, block2);
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
    });
  });
});

// having difficulty using node's util.promisify in the truffle tests, i think it's related to the context binding....
function promisify(fn) {
  return (...args) => new Promise((res, rej) => {
    fn(...args, (err, result) => {
      if (err) {
        rej(err);
      } else {
        res(result);
      }
    });
  });
}