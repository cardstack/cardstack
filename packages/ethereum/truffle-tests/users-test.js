const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('@cardstack/test-support/env');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

let transactionIndexer, ethereumClient, env, writers, searchers, user1Session, user2Session;

async function teardown() {
  await transactionIndexer._indexingPromise;
  await ethereumClient.stopAll();
  await destroyDefaultEnvironment(env);
}

async function waitForEthereumEvents(indexer) {
  await indexer._indexingPromise;
}

async function createUserAddress(session, address) {
  let { data: userAddress } = await writers.create('master', session, 'user-ethereum-addresses', {
    data: {
      type: 'user-ethereum-addresses',
      attributes: { 'ethereum-address': address },
      relationships: {
        'address-user': { data: { type: session.type, id: session.id } }
      }
    }
  });

  await waitForEthereumEvents(transactionIndexer);

  return userAddress;
}

async function deleteUserAddress(session, id) {
  await writers.delete('master', session, 1, 'user-ethereum-addresses', id);

  await waitForEthereumEvents(transactionIndexer);
}

contract('user-ethereum-addresses indexing', function (accounts) {
  const address = accounts[0].toLowerCase();

  describe('@cardstack/ethereum - users-ethereum-addresses', function () {
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

      let user1 = factory.addResource('test-users', 'vanGogh').withAttributes({ fullName: 'Van Gogh' });
      let user2 = factory.addResource('test-users', 'jojo').withAttributes({ fullName: 'Jojo' });

      env = await createDefaultEnvironment(`${__dirname}/..`, factory.getModels());
      searchers = env.lookup('hub:searchers');
      writers = env.lookup('hub:writers');
      user1Session = env.lookup('hub:sessions').create(user1.type, user1.id);
      user2Session = env.lookup('hub:sessions').create(user2.type, user2.id);
      transactionIndexer = env.lookup(`plugin-services:${require.resolve('../cardstack/transaction-indexer')}`);
      ethereumClient = transactionIndexer.ethereumClient;

      await waitForEthereumEvents(transactionIndexer);
    }

    beforeEach(setup);
    afterEach(teardown);

    it('can create a tracking-addresses resource when a user address is created', async function() {
      let { data: newUserAddress } = await writers.create('master', user1Session, 'user-ethereum-addresses', {
        data: {
          type: 'user-ethereum-addresses',
          attributes: { 'ethereum-address': address },
          relationships: {
            'address-user': { data: { type: user1Session.type, id: user1Session.id } }
          }
        }
      });

      // intentionally not awaiting ethereum events in order to assert the loading state
      expect(newUserAddress).to.have.deep.property('attributes.preparing-address', true);

      await waitForEthereumEvents(transactionIndexer);
      let response = await searchers.getFromControllingBranch(user1Session, 'user-ethereum-addresses', newUserAddress.id);

      let { data, included } = response;

      expect(data).to.have.deep.property('attributes.ethereum-address', address);
      expect(data).to.have.deep.property('attributes.preparing-address', false);
      expect(data).to.have.deep.property('relationships.address-user.data.id', user1Session.id);
      expect(data).to.have.deep.property('relationships.address-user.data.type', user1Session.type);
      expect(data).to.have.deep.property('relationships.address-data.data.id', address);
      expect(data).to.have.deep.property('relationships.address-data.data.type', 'ethereum-addresses');

      let addresses = included.filter(i => i.type === 'ethereum-addresses');
      expect(addresses.length).to.equal(1);
      expect(addresses[0]).to.have.property('id', address);
      expect(addresses[0]).to.not.have.deep.property('meta.loadingTransactions');
      expect(addresses[0].relationships.transactions.data.length).to.equal(4); // these are ganche setup transactions that funded all the addresses in the testing blockchain

      let transactions = included.filter(i => i.type === 'ethereum-transactions');
      expect(transactions.length).to.equal(4);

      let { data: trackedAddresses } = await searchers.searchFromControllingBranch(env.session, {
        filter: { type: { exact: 'tracked-ethereum-addresses'} }
      });

      expect(trackedAddresses.length).to.equal(1);
      expect(trackedAddresses[0].id).to.equal(address);
    });

    it('does not allow address-user specified on creation to be different than owner of the session', async function() {
      let error;
      try {
        await writers.create('master', user2Session, 'user-ethereum-addresses', {
          data: {
            type: 'user-ethereum-addresses',
            attributes: { 'ethereum-address': address },
            relationships: {
              'address-user': { data: { type: user1Session.type, id: user1Session.id } }
            }
          }
        });
      } catch (e) {
        error = e;
      }

      expect(error.status).to.equal(404);
    });

    it('does not allow user address to be updated', async function() {
      let userAddress = await createUserAddress(user1Session, address);

      userAddress.attributes['ethereum-address'] = accounts[1];

      let error;
      try {
        await writers.update('master', user1Session, userAddress.type, userAddress.id, { data: userAddress });
      } catch (e) {
        error = e;
      }

      expect(error.status).to.equal(403);
    });

    it('it stops tracking the ethereum address when the user address is deleted and there are no more user address documents that refer to the ethereum address', async function() {
      let { id } = await createUserAddress(user1Session, address);
      await deleteUserAddress(user1Session, id);

      let error;
      try {
        await searchers.getFromControllingBranch(env.session, 'user-ethereum-addresses', id);
      } catch (e) {
        error = e;
      }
      expect(error.status).to.equal(404);

      error = null;
      try {
        await searchers.getFromControllingBranch(env.session, 'tracked-ethereum-addresses', address);
      } catch (e) {
        error = e;
      }
      expect(error.status).to.equal(404);
    });

    it('it does not stop tracking the ethereum address when the user address is deleted but there are other user addresses tracking the ethereum addres', async function() {
      let { id } = await createUserAddress(user1Session, address);
      await createUserAddress(user2Session, address);
      await deleteUserAddress(user1Session, id);

      let error;
      try {
        await searchers.getFromControllingBranch(env.session, 'user-ethereum-addresses', id);
      } catch (e) {
        error = e;
      }
      expect(error.status).to.equal(404);

      let { data: trackedAddresses } = await searchers.searchFromControllingBranch(env.session, {
        filter: { type: { exact: 'tracked-ethereum-addresses'} }
      });

      expect(trackedAddresses.length).to.equal(1);
      expect(trackedAddresses[0].id).to.equal(address);
    });

    it('it does not let a user have mulitple user addresses that refer to the same ethereum address', async function() {
      let { id } = await createUserAddress(user1Session, address);

      let error;
      try {
        await createUserAddress(user1Session, address);
      } catch (e) {
        error = e;
      }
      expect(error.status).to.equal(403);

      let { data: userAddresses } = await searchers.searchFromControllingBranch(env.session, {
        filter: { type: { exact: 'user-ethereum-addresses'} }
      });
      expect(userAddresses.length).to.equal(1);
      expect(userAddresses[0].id).to.equal(id);

      let { data: trackedAddresses } = await searchers.searchFromControllingBranch(env.session, {
        filter: { type: { exact: 'tracked-ethereum-addresses'} }
      });

      expect(trackedAddresses.length).to.equal(1);
      expect(trackedAddresses[0].id).to.equal(address);
    });

    it('it does not allow a user to view someone else`s user address document', async function() {
      let { id, type } = await createUserAddress(user1Session, address);

      let error;
      try {
        await searchers.getFromControllingBranch(user2Session, type, id);
      } catch (e) {
        error = e;
      }

      expect(error.status).to.equal(404);
    });

    it('it does not allow a user to delete someone else`s user address document', async function() {
      let { id } = await createUserAddress(user1Session, address);

      let error;
      try {
        await deleteUserAddress(user2Session, id);
      } catch (e) {
        error = e;
      }

      expect(error.status).to.equal(401);
    });
  });
});