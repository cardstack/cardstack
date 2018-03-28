const SampleToken = artifacts.require("./SampleToken.sol");
const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('@cardstack/test-support/env');
const { promisify } = require('util');
const timeout = promisify(setTimeout);
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

async function waitForEthereumEvents(service) {
  while (service._indexQueue.length) {
    await timeout(100);
  }
  await service._indexerPromise;
}

contract('SampleToken', function(accounts) {
  let accountOne = accounts[0].toLowerCase();
  let accountTwo = accounts[1].toLowerCase();
  let accountThree = accounts[2].toLowerCase();

  describe('private blockchain sanity checks', function() {
    it("should mint SampleToken in the token owner account", async function() {
      let instance = await SampleToken.new();
      await instance.mint(accountOne, 10000);
      let balance = await instance.balanceOf(accountOne);

      expect(balance.toNumber()).to.equal(10000, "the owner account balance is correct");
    });

    it("should transfer the token", async function() {
      // Get initial balances of first and second account.
      let amount = 10;

      let token = await SampleToken.new();
      await token.mint(accountOne, 100);
      let accountOneStartingBalance = await token.balanceOf(accountOne);
      accountOneStartingBalance = accountOneStartingBalance.toNumber();

      let accountTwoStartingBalance = await token.balanceOf(accountTwo);
      accountTwoStartingBalance = accountTwoStartingBalance.toNumber();

      let txn = await token.transfer(accountTwo, amount, {from: accountOne});
      let accountOneEndingBalance = await token.balanceOf(accountOne);
      accountOneEndingBalance = accountOneEndingBalance.toNumber();
      let accountTwoEndingBalance = await token.balanceOf(accountTwo);
      accountTwoEndingBalance = accountTwoEndingBalance.toNumber();

      expect(accountOneEndingBalance).to.equal(accountOneStartingBalance - amount, "Amount was correctly taken from the sender");
      expect(accountTwoEndingBalance).to.equal(accountTwoStartingBalance + amount, "Amount was correctly sent to the receiver");

      expect(txn.logs.length).to.equal(1, "there is one event fired");
      expect(txn.logs[0].event).to.equal("Transfer", "A transfer event is fired");
      expect(txn.logs[0].args.from).to.equal(accountOne, "the sender address is correct");
      expect(txn.logs[0].args.to).to.equal(accountTwo, "the sender address is correct");
      expect(txn.logs[0].args.value.toNumber()).to.equal(amount, "the amount of tokens is correct");
    });
  });

  describe('ethereum-indexer', function() {
    let env, dataSource, token, ethereumService;

    async function setup() {
      let factory = new JSONAPIFactory();
      token = await SampleToken.new();
      await token.fund({ value: web3.toWei(0.01, 'ether'), from: accountOne });

      dataSource = factory.addResource('data-sources', 'ethereum')
        .withAttributes({
          'source-type': '@cardstack/ethereum',
          params: {
            branches: {
              master: { jsonRpcUrl: "ws://localhost:7545" }
            },
            contracts: {
              "sample-token": {
                abi: token.abi,
                addresses: { master: token.address },
                eventContentTriggers: {
                  Transfer: [ "sample-token-balance-of" ],
                  Mint: [ "sample-token-balance-of" ]
                }
              }
            }
          },
        });

      env = await createDefaultEnvironment(`${__dirname}/..`, factory.getModels());
      ethereumService = env.lookup(`plugin-services:${require.resolve('../cardstack/service')}`);
      ethereumService._setProcessQueueTimeout(10);
    }

    async function teardown() {
      await destroyDefaultEnvironment(env);
      await ethereumService.stop();
    }

    beforeEach(setup);
    afterEach(teardown);

    it('can generate schema from ERC-20 contract`s ABI', async function() {
      let schema = await env.lookup('hub:searchers').get(env.session, 'master', 'content-types', 'sample-token');
      expect(schema).to.deep.equal({
        "data": {
          "id": "sample-token",
          "type": "content-types",
          "relationships": {
            "fields": {
              "data": [
                {
                  "type": "fields",
                  "id": "ethereum-address"
                },
                {
                  "type": "fields",
                  "id": "balance-wei"
                },
                {
                  "id": "sample-token-minting-finished",
                  "type": "fields"
                },
                {
                  "type": "fields",
                  "id": "sample-token-name"
                },
                {
                  "type": "fields",
                  "id": "sample-token-total-supply"
                },
                {
                  "id": "sample-token-owner",
                  "type": "fields"
                },
                {
                  "type": "fields",
                  "id": "sample-token-symbol"
                }
              ]
            },
            "data-source": {
              "data": {
                "type": "data-sources",
                "id": dataSource.id
              }
            }
          }
        }
      });

      schema = await env.lookup('hub:searchers').get(env.session, 'master', 'grants', 'sample-token-grant');
      expect(schema).to.deep.equal({
        "data": {
          "type": "grants",
          "id": "sample-token-grant",
          "attributes": {
            "may-read-fields": true,
            "may-read-resource": true
          },
          "relationships": {
            "types": {
              "data": [
                {
                  "id": "sample-token",
                  "type": "content-types"
                }
              ]
            },
            "who": {
              "data": {
                "id": "everyone",
                "type": "groups"
              }
            }
          }
        }
      });


      schema = await env.lookup('hub:searchers').get(env.session, 'master', 'content-types', 'sample-token-balance-of');
      expect(schema).to.deep.equal({
        "data": {
          "type": "content-types",
          "id": "sample-token-balance-of",
          "relationships": {
            "fields": {
              "data": [
                {
                  "type": "fields",
                  "id": "ethereum-address"
                },
                {
                  "type": "fields",
                  "id": "mapping-number-value"
                },
                {
                  "type": "fields",
                  "id": "sample-token-contract"
                }
              ]
            },
            "data-source": {
              "data": {
                "type": "data-sources",
                "id": dataSource.id
              }
            }
          }
        }
      });

      schema = await env.lookup('hub:searchers').get(env.session, 'master', 'grants', 'sample-token-balance-of-grant');
      expect(schema).to.deep.equal({
        "data": {
          "type": "grants",
          "id": "sample-token-balance-of-grant",
          "attributes": {
            "may-read-fields": true,
            "may-read-resource": true
          },
          "relationships": {
            "who": {
              "data": {
                "id": "everyone",
                "type": "groups"
              }
            },
            "types": {
              "data": [
                {
                  "id": "sample-token-balance-of",
                  "type": "content-types"
                }
              ]
            }
          }
        }
      });

      schema = await env.lookup('hub:searchers').get(env.session, 'master', 'fields', 'sample-token-name');
      expect(schema).to.deep.equal({
        "data": {
          "type": "fields",
          "id": "sample-token-name",
          "attributes": {
            "field-type": "@cardstack/core-types::string"
          }
        }
      });

      schema = await env.lookup('hub:searchers').get(env.session, 'master', 'fields', 'sample-token-minting-finished');
      expect(schema).to.deep.equal({
        "data": {
          "type": "fields",
          "id": "sample-token-minting-finished",
          "attributes": {
            "field-type": "@cardstack/core-types::boolean"
          }
        }
      });

      schema = await env.lookup('hub:searchers').get(env.session, 'master', 'fields', 'sample-token-owner');
      expect(schema).to.deep.equal({
        "data": {
          "type": "fields",
          "id": "sample-token-owner",
          "attributes": {
            "field-type": "@cardstack/core-types::string"
          }
        }
      });

      schema = await env.lookup('hub:searchers').get(env.session, 'master', 'fields', 'sample-token-symbol');
      expect(schema).to.deep.equal({
        "data": {
          "type": "fields",
          "id": "sample-token-symbol",
          "attributes": {
            "field-type": "@cardstack/core-types::string"
          }
        }
      });

      schema = await env.lookup('hub:searchers').get(env.session, 'master', 'fields', 'sample-token-total-supply');
      expect(schema).to.deep.equal({
        "data": {
          "type": "fields",
          "id": "sample-token-total-supply",
          "attributes": {
            "field-type": "@cardstack/core-types::string"
          }
        }
      });

      schema = await env.lookup('hub:searchers').get(env.session, 'master', 'fields', 'sample-token-contract');
      expect(schema).to.deep.equal({
        "data": {
          "type": "fields",
          "id": "sample-token-contract",
          "attributes": {
            "field-type": "@cardstack/core-types::belongs-to"
          },
          "relationships": {
            "related-types": {
              "data": [
                {
                  "type": "content-types",
                  "id": "sample-token"
                }
              ]
            }
          }
        }
      });
    });

    it("indexes a contract", async function() {
      let contract = await env.lookup('hub:searchers').get(env.session, 'master', 'sample-token', token.address);
      contract.data.attributes["sample-token-owner"] = contract.data.attributes["sample-token-owner"].toLowerCase();
      expect(contract).to.deep.equal({
        "data": {
          "id": token.address,
          "type": "sample-token",
          "attributes": {
            "ethereum-address": token.address,
            "balance-wei": "10000000000000000",
            "sample-token-minting-finished": false,
            "sample-token-name": "SampleToken",
            "sample-token-total-supply": "0",
            "sample-token-owner": accounts[0],
            "sample-token-symbol": "TOK"
          }
        }
      });
    });

    it("indexes mapping entry content types when a contract fires an ethereum event", async function() {
      try {
        await env.lookup('hub:searchers').get(env.session, 'master', 'sample-token-balance-of', accountOne);
        throw new Error("balance-of record should not exist for this address");
      } catch (err) {
        expect(err.message).to.equal(`No such resource master/sample-token-balance-of/${accountOne}`);
      }

      try {
        await env.lookup('hub:searchers').get(env.session, 'master', 'sample-token-balance-of', accountTwo);
        throw new Error("balance-of record should not exist for this address");
      } catch (err) {
        expect(err.message).to.equal(`No such resource master/sample-token-balance-of/${accountTwo}`);
      }

      await token.mint(accountOne, 100);
      await token.transfer(accountTwo, 10, { from: accountOne });

      await waitForEthereumEvents(ethereumService);

      let accountOneLedgerEntry = await env.lookup('hub:searchers').get(env.session, 'master', 'sample-token-balance-of', accountOne);
      expect(accountOneLedgerEntry.data.attributes["ethereum-address"]).to.not.equal(accountOneLedgerEntry.data.id, 'the case between the addresses is different');
      accountOneLedgerEntry.data.attributes["ethereum-address"] = accountOneLedgerEntry.data.attributes["ethereum-address"].toLowerCase();
      expect(accountOneLedgerEntry).to.deep.equal({
        "data": {
          "id": accountOne,
          "type": "sample-token-balance-of",
          "attributes": {
            "ethereum-address": accountOne,
            "mapping-number-value": "90"
          },
          "relationships": {
            "sample-token-contract": {
              "data": {
                "id": token.address,
                "type": "sample-token"
              }
            }
          }
        }
      });

      let accountTwoLedgerEntry = await env.lookup('hub:searchers').get(env.session, 'master', 'sample-token-balance-of', accountTwo);
      expect(accountTwoLedgerEntry.data.attributes["mapping-number-value"]).to.equal("10", "the token balance is correct");
    });

  });

  describe('ethereum-indexer event triggers', function() {
    let env, token, ethereumService;

    async function setup() {
      let factory = new JSONAPIFactory();
      token = await SampleToken.new();

      await token.mint(accountOne, 100);

      factory.addResource('data-sources', 'ethereum',)
        .withAttributes({
          'source-type': '@cardstack/ethereum',
          params: {
            branches: {
              master: { jsonRpcUrl: "ws://localhost:7545" }
            },
            contracts: {
              "sample-token": {
                abi: token.abi,
                addresses: { master: token.address },
                eventContentTriggers: {
                  MintingFinished: []
                }
              }
            }
          },
        });

      env = await createDefaultEnvironment(`${__dirname}/..`, factory.getModels());
      ethereumService = env.lookup(`plugin-services:${require.resolve('../cardstack/service')}`);
      ethereumService._setProcessQueueTimeout(10);
    }

    async function teardown() {
      await destroyDefaultEnvironment(env);
      await ethereumService.stop();
    }

    beforeEach(setup);
    afterEach(teardown);

    it('can update contract document from event content trigger', async function() {

      let contract = await env.lookup('hub:searchers').get(env.session, 'master', 'sample-token', token.address);
      expect(contract.data.attributes['sample-token-minting-finished']).to.equal(false, 'the minting-finished field is correct');

      await token.finishMinting();
      await waitForEthereumEvents(ethereumService);

      contract = await env.lookup('hub:searchers').get(env.session, 'master', 'sample-token', token.address);
      expect(contract.data.attributes['sample-token-minting-finished']).to.equal(true, 'the minting-finished field is correct');
    });
  });

  describe('ethereum-indexer for past events', function() {
    let env, token, ethereumService;

    async function setup() {
      let factory = new JSONAPIFactory();
      token = await SampleToken.new();

      await token.mint(accountOne, 100);
      await token.transfer(accountTwo, 20, { from: accountOne });
      await token.transfer(accountThree, 30, { from: accountOne });
      await token.transfer(accountThree, 7, { from: accountTwo });

      factory.addResource('data-sources')
        .withAttributes({
          'source-type': '@cardstack/ethereum',
          params: {
            branches: {
              master: { jsonRpcUrl: "ws://localhost:7545" }
            },
            contracts: {
              "sample-token": {
                abi: token.abi,
                addresses: { master: token.address },
                eventContentTriggers: {
                  Transfer: [ "sample-token-balance-of" ],
                  Mint: [ "sample-token-balance-of" ]
                }
              }
            }
          },
        });

      env = await createDefaultEnvironment(`${__dirname}/..`, factory.getModels());
      ethereumService = env.lookup(`plugin-services:${require.resolve('../cardstack/service')}`);
      ethereumService._setProcessQueueTimeout(10);
    }

    async function teardown() {
      await destroyDefaultEnvironment(env);
      await ethereumService.stop();
    }

    beforeEach(setup);
    afterEach(teardown);

    it("can index past events on the contract", async function() {
      let accountOneLedgerEntry = await env.lookup('hub:searchers').get(env.session, 'master', 'sample-token-balance-of', accountOne.toLowerCase());
      let accountTwoLedgerEntry = await env.lookup('hub:searchers').get(env.session, 'master', 'sample-token-balance-of', accountTwo.toLowerCase());
      let accountThreeLedgerEntry = await env.lookup('hub:searchers').get(env.session, 'master', 'sample-token-balance-of', accountThree.toLowerCase());

      expect(accountOneLedgerEntry.data.attributes["mapping-number-value"]).to.equal("50", "the token balance is correct");
      expect(accountTwoLedgerEntry.data.attributes["mapping-number-value"]).to.equal("13", "the token balance is correct");
      expect(accountThreeLedgerEntry.data.attributes["mapping-number-value"]).to.equal("37", "the token balance is correct");
    });
  });
});
