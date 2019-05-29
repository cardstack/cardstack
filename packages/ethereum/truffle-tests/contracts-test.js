const SampleToken = artifacts.require("./SampleToken.sol");
const Oracle = artifacts.require("./TokenOracle.sol");
const Web3 = require('web3');
const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('@cardstack/test-support/env');
const addresses = require('./data/addresses');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
const { set, get } = require('lodash');

const contractName = 'sample-token';
const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
let eventIndexer, ethereumClient, env;

async function teardown() {
  await eventIndexer._indexingPromise;
  await ethereumClient.stopAll();
  await destroyDefaultEnvironment(env);
}

async function waitForEthereumEvents(indexer) {
  await indexer._indexingPromise;
}

contract('Token Indexing', function (accounts) {
  let accountOne = accounts[0].toLowerCase();
  let accountTwo = accounts[1].toLowerCase();
  let accountThree = accounts[2].toLowerCase();
  let accountFour = accounts[3].toLowerCase();

  describe('private blockchain sanity checks', function () {
    it("should mint SampleToken in the token owner account", async function () {
      let instance = await SampleToken.new();
      await instance.mint(accountOne, 10000);
      let balance = await instance.balanceOf(accountOne);

      expect(balance.toNumber()).to.equal(10000, "the owner account balance is correct");
    });

    it("should transfer the token", async function () {
      // Get initial balances of first and second account.
      let amount = 10;

      let token = await SampleToken.new();
      await token.mint(accountOne, 100);
      let accountOneStartingBalance = await token.balanceOf(accountOne);
      accountOneStartingBalance = accountOneStartingBalance.toNumber();

      let accountTwoStartingBalance = await token.balanceOf(accountTwo);
      accountTwoStartingBalance = accountTwoStartingBalance.toNumber();

      let txn = await token.transfer(accountTwo, amount, { from: accountOne });
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

  describe('@cardstack/ethereum - contracts', function () {
    describe('ethereum-indexer', function () {
      let dataSource, token;

      async function setup() {
        let factory = new JSONAPIFactory();
        token = await SampleToken.new();
        await token.fund({ value: web3.toWei(0.01, 'ether'), from: accountOne });

        dataSource = factory.addResource('data-sources', contractName)
          .withAttributes({
            'source-type': '@cardstack/ethereum',
            params: {
              jsonRpcUrls: [ "ws://localhost:7545" ],
              contract: {
                abi: token.abi,
                address: token.address,
                eventContentTriggers: {
                  TokenFrozen: [],
                  Transfer: ["sample-token-balance-ofs"],
                  Mint: ["sample-token-balance-ofs"],
                  WhiteList: ["sample-token-approved-buyers", "sample-token-custom-buyer-limits"],
                  VestedTokenGrant: ["sample-token-vesting-schedules"]
                }
              }
            },
          });

        env = await createDefaultEnvironment(`${__dirname}/..`, factory.getModels());
        eventIndexer = env.lookup(`plugin-services:${require.resolve('../cardstack/event-indexer')}`);
        ethereumClient = eventIndexer.ethereumClient;

        await waitForEthereumEvents(eventIndexer);
      }

      beforeEach(setup);
      afterEach(teardown);

      it('can generate schema from ERC-20 contract`s ABI', async function () {
        let schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'content-types', 'sample-tokens');
        expect(schema).to.deep.equal({
          "data": {
            "id": "sample-tokens",
            "type": "content-types",
            "meta": {
              "source": contractName
            },
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
                    "type": "fields",
                    "id": "sample-token-balance-limit"
                  },
                  {
                    "id": "sample-token-owner",
                    "type": "fields"
                  },
                  {
                    "type": "fields",
                    "id": "sample-token-symbol"
                  },
                  {
                    "type": "fields",
                    "id": "sample-token-buyer-count"
                  },
                  {
                    "id": "sample-token-token-frozen",
                    "type": "fields"
                  },
                  {
                    "id": "sample-token-token-frozen-events",
                    "type": "fields"
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

        schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'grants', 'sample-token-grant');
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
                    "id": "sample-tokens",
                    "type": "content-types"
                  }
                ]
              },
              "who": {
                "data": [{
                  "id": "everyone",
                  "type": "groups"
                }]
              }
            },
            "meta": {
              "source": contractName
            }
          }
        });


        schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'content-types', 'sample-token-balance-ofs');
        expect(schema).to.deep.equal({
          "data": {
            "type": "content-types",
            "id": "sample-token-balance-ofs",
            "relationships": {
              "fields": {
                "data": [
                  {
                    "type": "fields",
                    "id": "ethereum-address"
                  },
                  {
                    "type": "fields",
                    "id": "sample-token-contract"
                  },
                  {
                    "type": "fields",
                    "id": "mapping-number-value"
                  },
                  {
                    "type": "fields",
                    "id": "sample-token-transfer-events",
                  },
                  {
                    "type": "fields",
                    "id": "sample-token-mint-events",
                  }
                ]
              },
              "data-source": {
                "data": {
                  "type": "data-sources",
                  "id": dataSource.id
                }
              }
            },
            "meta": {
              "source": contractName
            }
          }
        });


        schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'content-types', 'sample-token-custom-buyer-limits');
        expect(schema).to.deep.equal({
          "data": {
            "type": "content-types",
            "id": "sample-token-custom-buyer-limits",
            "relationships": {
              "fields": {
                "data": [
                  {
                    "type": "fields",
                    "id": "ethereum-address"
                  },
                  {
                    "type": "fields",
                    "id": "sample-token-contract"
                  },
                  {
                    "type": "fields",
                    "id": "mapping-number-value"
                  },
                  {
                    "type": "fields",
                    "id": "sample-token-white-list-events"
                  }
                ]
              },
              "data-source": {
                "data": {
                  "type": "data-sources",
                  "id": dataSource.id
                }
              }
            },
            "meta": {
              "source": contractName
            }
          }
        });

        schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'content-types', 'sample-token-vesting-schedules');
        expect(schema).to.deep.equal({
          "data": {
            "type": "content-types",
            "id": "sample-token-vesting-schedules",
            "relationships": {
              "fields": {
                "data": [
                  {
                    "type": "fields",
                    "id": "ethereum-address"
                  },
                  {
                    "type": "fields",
                    "id": "sample-token-contract"
                  },
                  {
                    "type": "fields",
                    "id": "vesting-schedule-start-date"
                  },
                  {
                    "type": "fields",
                    "id": "vesting-schedule-cliff-date"
                  },
                  {
                    "type": "fields",
                    "id": "vesting-schedule-duration-sec"
                  },
                  {
                    "type": "fields",
                    "id": "vesting-schedule-fully-vested-amount"
                  },
                  {
                    "type": "fields",
                    "id": "vesting-schedule-revoke-date"
                  },
                  {
                    "type": "fields",
                    "id": "vesting-schedule-is-revocable"
                  },
                  {
                    "type": "fields",
                    "id": "sample-token-vested-token-grant-events"
                  }
                ]
              },
              "data-source": {
                "data": {
                  "type": "data-sources",
                  "id": dataSource.id
                }
              }
            },
            "meta": {
              "source": contractName
            }
          }
        });

        schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'fields', 'vesting-schedule-start-date');
        expect(schema).to.deep.equal({
          "data": {
            "type": "fields",
            "id": "vesting-schedule-start-date",
            "attributes": {
              "field-type": "@cardstack/core-types::string"
            },
            "meta": {
              "source": contractName
            }
          }
        });

        schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'fields', 'vesting-schedule-cliff-date');
        expect(schema).to.deep.equal({
          "data": {
            "type": "fields",
            "id": "vesting-schedule-cliff-date",
            "attributes": {
              "field-type": "@cardstack/core-types::string"
            },
            "meta": {
              "source": contractName
            }
          }
        });

        schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'fields', 'vesting-schedule-duration-sec');
        expect(schema).to.deep.equal({
          "data": {
            "type": "fields",
            "id": "vesting-schedule-duration-sec",
            "attributes": {
              "field-type": "@cardstack/core-types::string"
            },
            "meta": {
              "source": contractName
            }
          }
        });

        schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'fields', 'vesting-schedule-fully-vested-amount');
        expect(schema).to.deep.equal({
          "data": {
            "type": "fields",
            "id": "vesting-schedule-fully-vested-amount",
            "attributes": {
              "field-type": "@cardstack/core-types::string"
            },
            "meta": {
              "source": contractName
            }
          }
        });

        schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'fields', 'vesting-schedule-revoke-date');
        expect(schema).to.deep.equal({
          "data": {
            "type": "fields",
            "id": "vesting-schedule-revoke-date",
            "attributes": {
              "field-type": "@cardstack/core-types::string"
            },
            "meta": {
              "source": contractName
            }
          }
        });

        schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'fields', 'vesting-schedule-is-revocable');
        expect(schema).to.deep.equal({
          "data": {
            "type": "fields",
            "id": "vesting-schedule-is-revocable",
            "attributes": {
              "field-type": "@cardstack/core-types::boolean"
            },
            "meta": {
              "source": contractName
            }
          }
        });

        schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'grants', 'sample-token-vesting-schedule-grant');
        expect(schema).to.deep.equal({
          "data": {
            "type": "grants",
            "id": "sample-token-vesting-schedule-grant",
            "attributes": {
              "may-read-fields": true,
              "may-read-resource": true
            },
            "relationships": {
              "who": {
                "data": [{
                  "id": "everyone",
                  "type": "groups"
                }]
              },
              "types": {
                "data": [
                  {
                    "id": "sample-token-vesting-schedules",
                    "type": "content-types"
                  }
                ]
              }
            },
            "meta": {
              "source": contractName
            }
          }
        });

        schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'content-types', 'sample-token-approved-buyers');
        expect(schema).to.deep.equal({
          "data": {
            "type": "content-types",
            "id": "sample-token-approved-buyers",
            "relationships": {
              "fields": {
                "data": [
                  {
                    "type": "fields",
                    "id": "ethereum-address"
                  },
                  {
                    "type": "fields",
                    "id": "sample-token-contract"
                  },
                  {
                    "type": "fields",
                    "id": "mapping-boolean-value"
                  },
                  {
                    "type": "fields",
                    "id": "sample-token-white-list-events"
                  }
                ]
              },
              "data-source": {
                "data": {
                  "type": "data-sources",
                  "id": dataSource.id
                }
              }
            },
            "meta": {
              "source": contractName
            }
          }
        });

        schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'grants', 'sample-token-balance-of-grant');
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
                "data": [{
                  "id": "everyone",
                  "type": "groups"
                }]
              },
              "types": {
                "data": [
                  {
                    "id": "sample-token-balance-ofs",
                    "type": "content-types"
                  }
                ]
              }
            },
            "meta": {
              "source": contractName
            }
          }
        });

        schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'fields', 'sample-token-name');
        expect(schema).to.deep.equal({
          "data": {
            "type": "fields",
            "id": "sample-token-name",
            "attributes": {
              "field-type": "@cardstack/core-types::string"
            },
            "meta": {
              "source": contractName
            }
          }
        });

        schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'fields', 'sample-token-minting-finished');
        expect(schema).to.deep.equal({
          "data": {
            "type": "fields",
            "id": "sample-token-minting-finished",
            "attributes": {
              "field-type": "@cardstack/core-types::boolean"
            },
            "meta": {
              "source": contractName
            }
          }
        });

        schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'fields', 'sample-token-owner');
        expect(schema).to.deep.equal({
          "data": {
            "type": "fields",
            "id": "sample-token-owner",
            "attributes": {
              "field-type": "@cardstack/core-types::case-insensitive"
            },
            "meta": {
              "source": contractName
            }
          }
        });

        schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'fields', 'sample-token-symbol');
        expect(schema).to.deep.equal({
          "data": {
            "type": "fields",
            "id": "sample-token-symbol",
            "attributes": {
              "field-type": "@cardstack/core-types::string"
            },
            "meta": {
              "source": contractName
            }
          }
        });

        schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'fields', 'sample-token-total-supply');
        expect(schema).to.deep.equal({
          "data": {
            "type": "fields",
            "id": "sample-token-total-supply",
            "attributes": {
              "field-type": "@cardstack/core-types::string"
            },
            "meta": {
              "source": contractName
            }
          }
        });

        schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'fields', 'sample-token-contract');
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
                    "id": "sample-tokens"
                  }
                ]
              }
            },
            "meta": {
              "source": contractName
            }
          }
        });

        schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'content-types', 'sample-token-transfer-events');
        expect(schema).to.deep.equal({
          "data": {
            "type": "content-types",
            "id": "sample-token-transfer-events",
            "relationships": {
              "fields": {
                "data": [
                  {
                    "type": "fields",
                    "id": "block-number"
                  },
                  {
                    "type": "fields",
                    "id": "transaction-hash"
                  },
                  {
                    "type": "fields",
                    "id": "event-name"
                  },
                  {
                    "type": "fields",
                    "id": "sample-token-contract"
                  },
                  {
                    "type": "fields",
                    "id": "transfer-event-from"
                  },
                  {
                    "type": "fields",
                    "id": "transfer-event-to"
                  },
                  {
                    "type": "fields",
                    "id": "transfer-event-value"
                  },
                ]
              },
              "data-source": {
                "data": {
                  "type": "data-sources",
                  "id": dataSource.id
                }
              }
            },
            "meta": {
              "source": contractName
            }
          }
        });

        schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'grants', 'sample-token-transfer-events-grant');
        expect(schema).to.deep.equal({
          "data": {
            "type": "grants",
            "id": "sample-token-transfer-events-grant",
            "attributes": {
              "may-read-fields": true,
              "may-read-resource": true
            },
            "relationships": {
              "who": {
                "data": [{
                  "id": "everyone",
                  "type": "groups"
                }]
              },
              "types": {
                "data": [
                  {
                    "id": "sample-token-transfer-events",
                    "type": "content-types"
                  }
                ]
              }
            },
            "meta": {
              "source": contractName
            }
          }
        });

        schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'fields', 'sample-token-transfer-events');
        expect(schema).to.deep.equal({
          "data": {
            "type": "fields",
            "id": "sample-token-transfer-events",
            "attributes": {
              "field-type": "@cardstack/core-types::has-many"
            },
            "meta": {
              "source": contractName
            }
          }
        });

        schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'fields', 'transfer-event-from');
        expect(schema).to.deep.equal({
          "data": {
            "type": "fields",
            "id": "transfer-event-from",
            "attributes": {
              "field-type": "@cardstack/core-types::case-insensitive"
            },
            "meta": {
              "source": contractName
            }
          }
        });

        schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'fields', 'transfer-event-to');
        expect(schema).to.deep.equal({
          "data": {
            "type": "fields",
            "id": "transfer-event-to",
            "attributes": {
              "field-type": "@cardstack/core-types::case-insensitive"
            },
            "meta": {
              "source": contractName
            }
          }
        });

        schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'fields', 'transfer-event-value');
        expect(schema).to.deep.equal({
          "data": {
            "type": "fields",
            "id": "transfer-event-value",
            "attributes": {
              "field-type": "@cardstack/core-types::string"
            },
            "meta": {
              "source": contractName
            }
          }
        });

        schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'content-types', 'sample-token-token-frozen-events');
        expect(schema).to.deep.equal({
          "data": {
            "type": "content-types",
            "id": "sample-token-token-frozen-events",
            "relationships": {
              "fields": {
                "data": [
                  {
                    "type": "fields",
                    "id": "block-number"
                  },
                  {
                    "type": "fields",
                    "id": "transaction-hash"
                  },
                  {
                    "type": "fields",
                    "id": "event-name"
                  },
                  {
                    "type": "fields",
                    "id": "sample-token-contract"
                  },
                  {
                    "type": "fields",
                    "id": "token-frozen-event-is-frozen"
                  },
                ]
              },
              "data-source": {
                "data": {
                  "type": "data-sources",
                  "id": dataSource.id
                }
              }
            },
            "meta": {
              "source": contractName
            }
          }
        });

        schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'grants', 'sample-token-token-frozen-events-grant');
        expect(schema).to.deep.equal({
          "data": {
            "type": "grants",
            "id": "sample-token-token-frozen-events-grant",
            "attributes": {
              "may-read-fields": true,
              "may-read-resource": true
            },
            "relationships": {
              "who": {
                "data": [{
                  "id": "everyone",
                  "type": "groups"
                }]
              },
              "types": {
                "data": [
                  {
                    "id": "sample-token-token-frozen-events",
                    "type": "content-types"
                  }
                ]
              }
            },
            "meta": {
              "source": contractName
            }
          }
        });

        schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'fields', 'sample-token-token-frozen-events');
        expect(schema).to.deep.equal({
          "data": {
            "type": "fields",
            "id": "sample-token-token-frozen-events",
            "attributes": {
              "field-type": "@cardstack/core-types::has-many"
            },
            "meta": {
              "source": contractName
            }
          }
        });

        schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'fields', 'token-frozen-event-is-frozen');
        expect(schema).to.deep.equal({
          "data": {
            "type": "fields",
            "id": "token-frozen-event-is-frozen",
            "attributes": {
              "field-type": "@cardstack/core-types::boolean"
            },
            "meta": {
              "source": contractName
            }
          }
        });

        schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'content-types', 'sample-token-mint-events');
        expect(schema).to.deep.equal({
          "data": {
            "type": "content-types",
            "id": "sample-token-mint-events",
            "relationships": {
              "fields": {
                "data": [
                  {
                    "type": "fields",
                    "id": "block-number"
                  },
                  {
                    "type": "fields",
                    "id": "transaction-hash"
                  },
                  {
                    "type": "fields",
                    "id": "event-name"
                  },
                  {
                    "type": "fields",
                    "id": "sample-token-contract"
                  },
                  {
                    "type": "fields",
                    "id": "mint-event-to"
                  },
                  {
                    "type": "fields",
                    "id": "mint-event-amount"
                  },
                ]
              },
              "data-source": {
                "data": {
                  "type": "data-sources",
                  "id": dataSource.id
                }
              }
            },
            "meta": {
              "source": contractName
            }
          }
        });

        schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'grants', 'sample-token-mint-events-grant');
        expect(schema).to.deep.equal({
          "data": {
            "type": "grants",
            "id": "sample-token-mint-events-grant",
            "attributes": {
              "may-read-fields": true,
              "may-read-resource": true
            },
            "relationships": {
              "who": {
                "data": [{
                  "id": "everyone",
                  "type": "groups"
                }]
              },
              "types": {
                "data": [
                  {
                    "id": "sample-token-mint-events",
                    "type": "content-types"
                  }
                ]
              }
            },
            "meta": {
              "source": contractName
            }
          }
        });

        schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'fields', 'sample-token-mint-events');
        expect(schema).to.deep.equal({
          "data": {
            "type": "fields",
            "id": "sample-token-mint-events",
            "attributes": {
              "field-type": "@cardstack/core-types::has-many"
            },
            "meta": {
              "source": contractName
            }
          }
        });

        schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'fields', 'mint-event-to');
        expect(schema).to.deep.equal({
          "data": {
            "type": "fields",
            "id": "mint-event-to",
            "attributes": {
              "field-type": "@cardstack/core-types::case-insensitive"
            },
            "meta": {
              "source": contractName
            }
          }
        });

        schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'fields', 'mint-event-amount');
        expect(schema).to.deep.equal({
          "data": {
            "type": "fields",
            "id": "mint-event-amount",
            "attributes": {
              "field-type": "@cardstack/core-types::string"
            },
            "meta": {
              "source": contractName
            }
          }
        });

        schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'content-types', 'sample-token-white-list-events');
        expect(schema).to.deep.equal({
          "data": {
            "type": "content-types",
            "id": "sample-token-white-list-events",
            "relationships": {
              "fields": {
                "data": [
                  {
                    "type": "fields",
                    "id": "block-number"
                  },
                  {
                    "type": "fields",
                    "id": "transaction-hash"
                  },
                  {
                    "type": "fields",
                    "id": "event-name"
                  },
                  {
                    "type": "fields",
                    "id": "sample-token-contract"
                  },
                  {
                    "type": "fields",
                    "id": "white-list-event-buyer"
                  },
                  {
                    "type": "fields",
                    "id": "white-list-event-hold-cap"
                  },
                ]
              },
              "data-source": {
                "data": {
                  "type": "data-sources",
                  "id": dataSource.id
                }
              }
            },
            "meta": {
              "source": contractName
            }
          }
        });

        schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'grants', 'sample-token-white-list-events-grant');
        expect(schema).to.deep.equal({
          "data": {
            "type": "grants",
            "id": "sample-token-white-list-events-grant",
            "attributes": {
              "may-read-fields": true,
              "may-read-resource": true
            },
            "relationships": {
              "who": {
                "data": [{
                  "id": "everyone",
                  "type": "groups"
                }]
              },
              "types": {
                "data": [
                  {
                    "id": "sample-token-white-list-events",
                    "type": "content-types"
                  }
                ]
              }
            },
            "meta": {
              "source": contractName
            }
          }
        });

        schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'fields', 'sample-token-white-list-events');
        expect(schema).to.deep.equal({
          "data": {
            "type": "fields",
            "id": "sample-token-white-list-events",
            "attributes": {
              "field-type": "@cardstack/core-types::has-many"
            },
            "meta": {
              "source": contractName
            }
          }
        });

        schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'fields', 'white-list-event-buyer');
        expect(schema).to.deep.equal({
          "data": {
            "type": "fields",
            "id": "white-list-event-buyer",
            "attributes": {
              "field-type": "@cardstack/core-types::case-insensitive"
            },
            "meta": {
              "source": contractName
            }
          }
        });

        schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'fields', 'white-list-event-hold-cap');
        expect(schema).to.deep.equal({
          "data": {
            "type": "fields",
            "id": "white-list-event-hold-cap",
            "attributes": {
              "field-type": "@cardstack/core-types::string"
            },
            "meta": {
              "source": contractName
            }
          }
        });

        schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'content-types', 'sample-token-vested-token-grant-events');
        expect(schema).to.deep.equal({
          "data": {
            "type": "content-types",
            "id": "sample-token-vested-token-grant-events",
            "relationships": {
              "fields": {
                "data": [
                  {
                    "type": "fields",
                    "id": "block-number"
                  },
                  {
                    "type": "fields",
                    "id": "transaction-hash"
                  },
                  {
                    "type": "fields",
                    "id": "event-name"
                  },
                  {
                    "type": "fields",
                    "id": "sample-token-contract"
                  },
                  {
                    "type": "fields",
                    "id": "vested-token-grant-event-beneficiary"
                  },
                  {
                    "type": "fields",
                    "id": "vested-token-grant-event-start-date"
                  },
                  {
                    "type": "fields",
                    "id": "vested-token-grant-event-cliff-sec"
                  },
                  {
                    "type": "fields",
                    "id": "vested-token-grant-event-duration-sec"
                  },
                  {
                    "type": "fields",
                    "id": "vested-token-grant-event-fully-vested-amount"
                  },
                  {
                    "type": "fields",
                    "id": "vested-token-grant-event-revoke-date"
                  },
                  {
                    "type": "fields",
                    "id": "vested-token-grant-event-is-revocable"
                  },
                ]
              },
              "data-source": {
                "data": {
                  "type": "data-sources",
                  "id": dataSource.id
                }
              }
            },
            "meta": {
              "source": contractName
            }
          }
        });

        schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'grants', 'sample-token-vested-token-grant-events-grant');
        expect(schema).to.deep.equal({
          "data": {
            "type": "grants",
            "id": "sample-token-vested-token-grant-events-grant",
            "attributes": {
              "may-read-fields": true,
              "may-read-resource": true
            },
            "relationships": {
              "who": {
                "data": [{
                  "id": "everyone",
                  "type": "groups"
                }]
              },
              "types": {
                "data": [
                  {
                    "id": "sample-token-vested-token-grant-events",
                    "type": "content-types"
                  }
                ]
              }
            },
            "meta": {
              "source": contractName
            }
          }
        });

        schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'fields', 'sample-token-vested-token-grant-events');
        expect(schema).to.deep.equal({
          "data": {
            "type": "fields",
            "id": "sample-token-vested-token-grant-events",
            "attributes": {
              "field-type": "@cardstack/core-types::has-many"
            },
            "meta": {
              "source": contractName
            }
          }
        });

        schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'fields', 'vested-token-grant-event-beneficiary');
        expect(schema).to.deep.equal({
          "data": {
            "type": "fields",
            "id": "vested-token-grant-event-beneficiary",
            "attributes": {
              "field-type": "@cardstack/core-types::case-insensitive"
            },
            "meta": {
              "source": contractName
            }
          }
        });

        schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'fields', 'vested-token-grant-event-start-date');
        expect(schema).to.deep.equal({
          "data": {
            "type": "fields",
            "id": "vested-token-grant-event-start-date",
            "attributes": {
              "field-type": "@cardstack/core-types::string"
            },
            "meta": {
              "source": contractName
            }
          }
        });

        schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'fields', 'vested-token-grant-event-cliff-sec');
        expect(schema).to.deep.equal({
          "data": {
            "type": "fields",
            "id": "vested-token-grant-event-cliff-sec",
            "attributes": {
              "field-type": "@cardstack/core-types::string"
            },
            "meta": {
              "source": contractName
            }
          }
        });

        schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'fields', 'vested-token-grant-event-duration-sec');
        expect(schema).to.deep.equal({
          "data": {
            "type": "fields",
            "id": "vested-token-grant-event-duration-sec",
            "attributes": {
              "field-type": "@cardstack/core-types::string"
            },
            "meta": {
              "source": contractName
            }
          }
        });

        schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'fields', 'vested-token-grant-event-fully-vested-amount');
        expect(schema).to.deep.equal({
          "data": {
            "type": "fields",
            "id": "vested-token-grant-event-fully-vested-amount",
            "attributes": {
              "field-type": "@cardstack/core-types::string"
            },
            "meta": {
              "source": contractName
            }
          }
        });

        schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'fields', 'vested-token-grant-event-revoke-date');
        expect(schema).to.deep.equal({
          "data": {
            "type": "fields",
            "id": "vested-token-grant-event-revoke-date",
            "attributes": {
              "field-type": "@cardstack/core-types::string"
            },
            "meta": {
              "source": contractName
            }
          }
        });

        schema = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'fields', 'vested-token-grant-event-is-revocable');
        expect(schema).to.deep.equal({
          "data": {
            "type": "fields",
            "id": "vested-token-grant-event-is-revocable",
            "attributes": {
              "field-type": "@cardstack/core-types::boolean"
            },
            "meta": {
              "source": contractName
            }
          }
        });
      });

      it("indexes a contract", async function () {
        let contract = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'sample-tokens', token.address);
        contract.data.attributes["sample-token-owner"] = contract.data.attributes["sample-token-owner"].toLowerCase();
        delete contract.data.meta;
        expect(contract).to.deep.equal({
          "data": {
            "id": token.address,
            "type": "sample-tokens",
            "attributes": {
              "ethereum-address": token.address,
              "balance-wei": "10000000000000000",
              "sample-token-balance-limit": "0",
              "sample-token-buyer-count": "0",
              "sample-token-minting-finished": false,
              "sample-token-name": "SampleToken",
              "sample-token-total-supply": "0",
              "sample-token-owner": accounts[0],
              "sample-token-token-frozen": false,
              "sample-token-symbol": "TOK"
            }
          }
        });
      });

      it("indexes mapping entry that contains multiple return values", async function () {
        let { logs: events } = await token.grantVestedTokens(accountOne,
          100,
          1000000000,
          1000500000,
          500000,
          1000600000,
          true);
        let eventId = `${events[0].transactionHash}_${events[0].logIndex}`;

        await waitForEthereumEvents(eventIndexer);

        let vestingSchedule = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'sample-token-vesting-schedules', accountOne);

        expect(vestingSchedule.data.attributes["ethereum-address"]).to.not.equal(vestingSchedule.data.id, 'the case between the addresses is different');
        vestingSchedule.data.attributes["ethereum-address"] = vestingSchedule.data.attributes["ethereum-address"].toLowerCase();
        delete vestingSchedule.data.meta;
        expect(vestingSchedule).to.deep.equal({
          "data": {
            "id": accountOne,
            "type": "sample-token-vesting-schedules",
            "attributes": {
              "ethereum-address": accountOne,
              "vesting-schedule-fully-vested-amount": "100",
              "vesting-schedule-start-date": "1000000000",
              "vesting-schedule-cliff-date": "1000500000",
              "vesting-schedule-duration-sec": "500000",
              "vesting-schedule-revoke-date": "1000600000",
              "vesting-schedule-is-revocable": true
            },
            "relationships": {
              "sample-token-contract": {
                "data": {
                  "id": token.address,
                  "type": "sample-tokens"
                }
              },
              "sample-token-vested-token-grant-events": {
                "data": [
                  {
                    "id": eventId,
                    "type": "sample-token-vested-token-grant-events"
                  }
                ]
              }
            },
          }
        });
      });

      it("indexes mapping entry content types when a contract fires an ethereum event", async function () {
        try {
          await env.lookup('hub:searchers').get(env.session, 'local-hub', 'sample-token-balance-ofs', accountOne);
          throw new Error("balance-of record should not exist for this address");
        } catch (err) {
          expect(err.message).to.equal(`No such resource local-hub/sample-token-balance-ofs/${accountOne}`);
        }

        try {
          await env.lookup('hub:searchers').get(env.session, 'local-hub', 'sample-token-balance-ofs', accountTwo);
          throw new Error("balance-of record should not exist for this address");
        } catch (err) {
          expect(err.message).to.equal(`No such resource local-hub/sample-token-balance-ofs/${accountTwo}`);
        }

        let { logs: mintEvents } = await token.mint(accountOne, 100);
        let { logs: transferEvents } = await token.transfer(accountTwo, 10, { from: accountOne });
        let mintEventId = `${mintEvents[0].transactionHash}_${mintEvents[0].logIndex}`;
        let transferEvent1Id = `${mintEvents[1].transactionHash}_${mintEvents[1].logIndex}`;
        let transferEvent2Id = `${transferEvents[0].transactionHash}_${transferEvents[0].logIndex}`;

        await waitForEthereumEvents(eventIndexer);

        let accountOneLedgerEntry = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'sample-token-balance-ofs', accountOne);
        expect(accountOneLedgerEntry.data.attributes["ethereum-address"]).to.not.equal(accountOneLedgerEntry.data.id, 'the case between the addresses is different');
        accountOneLedgerEntry.data.attributes["ethereum-address"] = accountOneLedgerEntry.data.attributes["ethereum-address"].toLowerCase();
        delete accountOneLedgerEntry.data.meta;
        expect(accountOneLedgerEntry).to.deep.equal({
          "data": {
            "id": accountOne,
            "type": "sample-token-balance-ofs",
            "attributes": {
              "ethereum-address": accountOne,
              "mapping-number-value": "90"
            },
            "relationships": {
              "sample-token-contract": {
                "data": {
                  "id": token.address,
                  "type": "sample-tokens"
                }
              },
              "sample-token-mint-events": {
                "data": [{ type: "sample-token-mint-events", id: mintEventId }]
              },
              "sample-token-transfer-events": {
                "data": [{
                  type: "sample-token-transfer-events",
                  id: transferEvent1Id
                }, {
                  type: "sample-token-transfer-events",
                  id: transferEvent2Id
                }]
              }
            },
          }
        });

        let accountTwoLedgerEntry = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'sample-token-balance-ofs', accountTwo);
        expect(accountTwoLedgerEntry.data.attributes["mapping-number-value"]).to.equal("10", "the token balance is correct");

        let transferEvent1 = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'sample-token-transfer-events', transferEvent1Id);
        delete transferEvent1.data.meta;
        toLowercase(transferEvent1, 'data.attributes.transfer-event-from');
        toLowercase(transferEvent1, 'data.attributes.transfer-event-to');
        expect(transferEvent1).to.deep.equal({
          data: {
            id: transferEvent1Id,
            type: 'sample-token-transfer-events',
            attributes: {
              'block-number': mintEvents[0].blockNumber,
              'transaction-hash': mintEvents[0].transactionHash,
              'event-name': 'Transfer',
              'transfer-event-from': NULL_ADDRESS,
              'transfer-event-to': accountOne,
              'transfer-event-value': '100'
            },
            relationships: {
              "sample-token-contract": {
                data: { id: token.address, type: "sample-tokens" }
              },
            }
          }
        });

        let transferEvent2 = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'sample-token-transfer-events', transferEvent2Id);
        toLowercase(transferEvent2, 'data.attributes.transfer-event-from');
        toLowercase(transferEvent2, 'data.attributes.transfer-event-to');
        expect(transferEvent2.data.attributes["block-number"]).to.equal(transferEvents[0].blockNumber, 'the block number is correct');
        expect(transferEvent2.data.attributes["transaction-hash"]).to.equal(transferEvents[0].transactionHash, 'the transaction id is correct');
        expect(transferEvent2.data.attributes["event-name"]).to.equal('Transfer', 'the event name is correct');
        expect(transferEvent2.data.attributes["transfer-event-from"]).to.equal(accountOne, 'the transaction event from address is correct');
        expect(transferEvent2.data.attributes["transfer-event-to"]).to.equal(accountTwo, 'the transaction event to address is correct');
        expect(transferEvent2.data.attributes["transfer-event-value"]).to.equal('10', 'the transaction event value is correct');
      });

      it("indexes mapping entry content with different field types for the same event", async function () {
        try {
          await env.lookup('hub:searchers').get(env.session, 'local-hub', 'sample-token-custom-buyer-limits', accountOne);
          throw new Error("sample-token-custom-buyer-limits record should not exist for this address");
        } catch (err) {
          expect(err.message).to.equal(`No such resource local-hub/sample-token-custom-buyer-limits/${accountOne}`);
        }

        try {
          await env.lookup('hub:searchers').get(env.session, 'local-hub', 'sample-token-approved-buyers', accountOne);
          throw new Error("sample-token-approved-buyers record should not exist for this address");
        } catch (err) {
          expect(err.message).to.equal(`No such resource local-hub/sample-token-approved-buyers/${accountOne}`);
        }

        try {
          await env.lookup('hub:searchers').get(env.session, 'local-hub', 'sample-token-custom-buyer-limits', accountTwo);
          throw new Error("sample-token-custom-buyer-limits record should not exist for this address");
        } catch (err) {
          expect(err.message).to.equal(`No such resource local-hub/sample-token-custom-buyer-limits/${accountTwo}`);
        }

        try {
          await env.lookup('hub:searchers').get(env.session, 'local-hub', 'sample-token-approved-buyers', accountTwo);
          throw new Error("sample-token-approved-buyers record should not exist for this address");
        } catch (err) {
          expect(err.message).to.equal(`No such resource local-hub/sample-token-approved-buyers/${accountTwo}`);
        }

        let { logs: events } = await token.addBuyer(accountOne);
        let eventId = `${events[0].transactionHash}_${events[0].logIndex}`;
        await token.setCustomBuyer(accountTwo, 10);
        await waitForEthereumEvents(eventIndexer);

        await env.lookup('hub:indexers').update({ forceRefresh: true });
        await waitForEthereumEvents(eventIndexer);

        let accountOneApprovedBuyer = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'sample-token-approved-buyers', accountOne);
        accountOneApprovedBuyer.data.attributes["ethereum-address"] = accountOneApprovedBuyer.data.attributes["ethereum-address"].toLowerCase();
        delete accountOneApprovedBuyer.data.meta;
        expect(accountOneApprovedBuyer).to.deep.equal({
          "data": {
            "id": accountOne,
            "type": "sample-token-approved-buyers",
            "attributes": {
              "ethereum-address": accountOne,
              "mapping-boolean-value": true
            },
            "relationships": {
              "sample-token-contract": {
                "data": {
                  "id": token.address,
                  "type": "sample-tokens"
                }
              },
              "sample-token-white-list-events": {
                "data": [
                  {
                    "id": eventId,
                    "type": "sample-token-white-list-events"
                  }
                ]
              }
            },
          }
        });

        let accountOneCustomBuyerLimit = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'sample-token-custom-buyer-limits', accountOne);
        accountOneCustomBuyerLimit.data.attributes["ethereum-address"] = accountOneCustomBuyerLimit.data.attributes["ethereum-address"].toLowerCase();
        delete accountOneCustomBuyerLimit.data.meta;
        expect(accountOneCustomBuyerLimit).to.deep.equal({
          "data": {
            "id": accountOne,
            "type": "sample-token-custom-buyer-limits",
            "attributes": {
              "ethereum-address": accountOne,
              "mapping-number-value": "0"
            },
            "relationships": {
              "sample-token-contract": {
                "data": {
                  "id": token.address,
                  "type": "sample-tokens"
                }
              },
              "sample-token-white-list-events": {
                "data": [
                  {
                    "id": eventId,
                    "type": "sample-token-white-list-events"
                  }
                ]
              }
            },
          }
        });

        let accountTwoApprovedBuyer = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'sample-token-approved-buyers', accountTwo);
        expect(accountTwoApprovedBuyer.data.attributes["mapping-boolean-value"]).to.equal(true, "the mapping-boolean-value is correct");

        let accountTwoCustomBuyerLimit = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'sample-token-custom-buyer-limits', accountTwo);
        expect(accountTwoCustomBuyerLimit.data.attributes["mapping-number-value"]).to.equal("10", "the mapping-number-value is correct");
      });
    });

    describe('ethereum-indexer event triggers', function () {
      let token;

      async function setup() {
        let factory = new JSONAPIFactory();
        token = await SampleToken.new();

        await token.mint(accountOne, 100);

        factory.addResource('data-sources', contractName)
          .withAttributes({
            'source-type': '@cardstack/ethereum',
            params: {
              jsonRpcUrls: [ "ws://localhost:7545" ],
              contract: {
                abi: token.abi,
                address: token.address,
                eventContentTriggers: {
                  MintFinished: []
                }
              }
            },
          });

        env = await createDefaultEnvironment(`${__dirname}/..`, factory.getModels());
        eventIndexer = env.lookup(`plugin-services:${require.resolve('../cardstack/event-indexer')}`);
        ethereumClient = eventIndexer.ethereumClient;

        await waitForEthereumEvents(eventIndexer);
      }

      beforeEach(setup);
      afterEach(teardown);

      it('can update contract document from event content trigger', async function () {
        let contract = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'sample-tokens', token.address);
        expect(contract.data.attributes['sample-token-minting-finished']).to.equal(false, 'the minting-finished field is correct');

        let { logs: events } = await token.finishMinting();
        let eventId = `${events[0].transactionHash}_${events[0].logIndex}`;
        await waitForEthereumEvents(eventIndexer);

        contract = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'sample-tokens', token.address);
        expect(contract.data.attributes['sample-token-minting-finished']).to.equal(true, 'the minting-finished field is correct');

        expect(contract.data.relationships['sample-token-mint-finished-events']).to.deep.equal({
          "data": [{ type: "sample-token-mint-finished-events", id: eventId }]
        });

        let event = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'sample-token-mint-finished-events', eventId);
        expect(event.data.attributes["block-number"]).to.equal(events[0].blockNumber, 'the block number is correct');
        expect(event.data.attributes["transaction-hash"]).to.equal(events[0].transactionHash, 'the transaction id is correct');
        expect(event.data.attributes["event-name"]).to.equal('MintFinished', 'the event name is correct');
      });
    });

    describe('ethereum-indexer for past events', function () {
      let token, pgclient, indexers, contract;

      async function setup() {
        let factory = new JSONAPIFactory();
        token = await SampleToken.new();

        let dataSource = factory.addResource('data-sources', contractName)
          .withAttributes({
            'source-type': '@cardstack/ethereum',
            params: {
              jsonRpcUrls: [ "ws://localhost:7545" ],
              contract: {
                abi: token.abi,
                address: token.address,
                indexingSkipIndicators: ["tokenFrozen"],
                eventContentTriggers: {
                  WhiteList: ["sample-token-approved-buyers"],
                  Transfer: ["sample-token-balance-ofs"],
                  Mint: ["sample-token-balance-ofs"]
                }
              }
            },
          });

        contract = dataSource.data.attributes.params.contract,
          env = await createDefaultEnvironment(`${__dirname}/..`, factory.getModels());
        indexers = await env.lookup('hub:indexers');
        pgclient = await env.lookup(`plugin-client:${require.resolve('@cardstack/pgsearch/client')}`);

        eventIndexer = env.lookup(`plugin-services:${require.resolve('../cardstack/event-indexer')}`);
        ethereumClient = eventIndexer.ethereumClient;

        await waitForEthereumEvents(eventIndexer);
      }

      beforeEach(setup);
      afterEach(teardown);

      it('can capture events documents from events that were fired before hub started', async function () {
        let { logs: mintEvents } = await token.mint(accountOne, 100);

        let mintEventId = `${mintEvents[0].transactionHash}_${mintEvents[0].logIndex}`;
        let transferEventId = `${mintEvents[1].transactionHash}_${mintEvents[1].logIndex}`;

        await ethereumClient.startEventListening({ contract, name: contractName, eventIndexer });
        await indexers.update({ forceRefresh: true });
        await waitForEthereumEvents(eventIndexer);

        let accountOneLedgerEntry = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'sample-token-balance-ofs', accountOne);

        expect(accountOneLedgerEntry.data.relationships['sample-token-mint-events']).to.deep.equal({
          "data": [{ type: "sample-token-mint-events", id: mintEventId }]
        });

        expect(accountOneLedgerEntry.data.relationships['sample-token-transfer-events']).to.deep.equal({
          "data": [{ type: "sample-token-transfer-events", id: transferEventId }]
        });

        let transferEvent = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'sample-token-transfer-events', transferEventId);
        toLowercase(transferEvent, 'data.attributes.transfer-event-from');
        toLowercase(transferEvent, 'data.attributes.transfer-event-to');
        expect(transferEvent.data.attributes["block-number"]).to.equal(mintEvents[1].blockNumber, 'the block number is correct');
        expect(transferEvent.data.attributes["transaction-hash"]).to.equal(mintEvents[1].transactionHash, 'the transaction id is correct');
        expect(transferEvent.data.attributes["event-name"]).to.equal('Transfer', 'the event name is correct');
        expect(transferEvent.data.attributes["transfer-event-from"]).to.equal(NULL_ADDRESS, 'the transaction event from address is correct');
        expect(transferEvent.data.attributes["transfer-event-to"]).to.equal(accountOne, 'the transaction event to address is correct');
        expect(transferEvent.data.attributes["transfer-event-value"]).to.equal('100', 'the transaction event value is correct');
      });

      it("indexes past events that occur at a block height heigher than the last time it has indexed", async function () {
        await ethereumClient.stopAll();

        let addCount = 0;

        pgclient.on('add', ({ type }) => {
          if (!['sample-tokens', 'sample-token-balance-ofs'].includes(type)) { return; }
          addCount++;
        });

        await token.mint(accountOne, 100);
        await token.transfer(accountTwo, 20, { from: accountOne });
        await token.transfer(accountThree, 30, { from: accountOne });

        await ethereumClient.startEventListening({ contract, name: contractName, eventIndexer });
        await indexers.update({ forceRefresh: true });
        await waitForEthereumEvents(eventIndexer);

        expect(addCount).to.equal(7, 'the correct number of records were indexed');

        await ethereumClient.stopAll();

        await token.transfer(accountFour, 20, { from: accountOne });

        await ethereumClient.startEventListening({ contract, name: contractName, eventIndexer });
        await indexers.update({ forceRefresh: true });
        await waitForEthereumEvents(eventIndexer);

        // the add count increases by 3:
        //   1 record for the sender of the transfer
        //   1 record for the recipient of transfer
        //   1 record for the token
        expect(addCount).to.equal(10, 'the correct number of records were indexed');
      });

      it("skips indexing when contract state indicates that the contract is not prepared to be indexed", async function () {
        await ethereumClient.stopAll();

        let addCount = 0;

        pgclient.on('add', ({ type }) => {
          if (!['sample-tokens', 'sample-token-balance-ofs'].includes(type)) { return; }
          addCount++;
        });

        await token.mint(accountOne, 100);
        await token.transfer(accountTwo, 20, { from: accountOne });
        await token.setTokenFrozen(true);

        await ethereumClient.startEventListening({ contract, name: contractName, eventIndexer });
        await indexers.update({ forceRefresh: true });
        await waitForEthereumEvents(eventIndexer);

        expect(addCount).to.equal(0, 'the contract is not indexed while it is frozen');

        await token.setTokenFrozen(false);

        await indexers.update({ forceRefresh: true });
        await waitForEthereumEvents(eventIndexer);

        expect(addCount).to.equal(5, 'the correct number of records were indexed');
        let accountOneLedgerEntry = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'sample-token-balance-ofs', accountOne);
        let accountTwoLedgerEntry = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'sample-token-balance-ofs', accountTwo);

        expect(accountOneLedgerEntry.data.attributes["mapping-number-value"]).to.equal("80", "the token balance is correct");
        expect(accountTwoLedgerEntry.data.attributes["mapping-number-value"]).to.equal("20", "the token balance is correct");
      });

    });

    describe('ethereum-indexer multiple contracts with past events', function () {
      let token, oracle, tokenEvents, oracleEvents;

      async function setup() {
        let factory = new JSONAPIFactory();
        token = await SampleToken.new();
        oracle = await Oracle.new();

        tokenEvents = (await token.mint(accountOne, 100)).logs;
        oracleEvents = (await oracle.addToken(token.address, 'TOK', 1000)).logs;

        factory.addResource('data-sources', contractName)
          .withAttributes({
            'source-type': '@cardstack/ethereum',
            params: {
              jsonRpcUrls: [ "ws://localhost:7545" ],
              contract: {
                abi: token.abi,
                address: token.address,
                eventContentTriggers: {
                  Mint: ["sample-token-balance-ofs"],
                  Transfer: ["sample-token-balance-ofs"],
                }
              }
            },
          });

        factory.addResource('data-sources', 'oracle')
          .withAttributes({
            'source-type': '@cardstack/ethereum',
            params: {
              jsonRpcUrls: [ "ws://localhost:7545" ],
              contract: {
                abi: oracle.abi,
                address: oracle.address,
                eventContentTriggers: {
                  TokenAdded: ['oracle-tokens']
                }
              }
            },
          });

        env = await createDefaultEnvironment(`${__dirname}/..`, factory.getModels());
        eventIndexer = env.lookup(`plugin-services:${require.resolve('../cardstack/event-indexer')}`);
        ethereumClient = eventIndexer.ethereumClient;

        await waitForEthereumEvents(eventIndexer);
      }

      beforeEach(setup);
      afterEach(teardown);

      it('can index multiple contracts with past events', async function() {
        let { data: accountOneLedgerEntry } = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'sample-token-balance-ofs', accountOne);
        expect(accountOneLedgerEntry.attributes['mapping-number-value']).to.equal('100');

        let [ { transactionHash:mintEventId }, { transactionHash:transferEventId } ]  = tokenEvents;
        let [ { transactionHash:tokenAddedEventId } ]  = oracleEvents;

        let { data: mintEvent } = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'sample-token-mint-events', `${mintEventId}_0`);
        expect(mintEvent.attributes['mint-event-amount']).to.equal('100');
        let { data: transferEvent } = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'sample-token-transfer-events', `${transferEventId}_1`);
        expect(transferEvent.attributes['transfer-event-value']).to.equal('100');

        let { data: tokenAddedEvent } = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'oracle-token-added-events', `${tokenAddedEventId}_0`);
        expect(tokenAddedEvent.attributes['token-added-event-rate']).to.equal('1000');

        let { data: oracleToken } = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'oracle-tokens', token.address);
        expect(oracleToken.attributes['tokens-token-address']).to.equal(Web3.utils.toChecksumAddress(token.address));
        expect(oracleToken.attributes['tokens-token-symbol']).to.equal('TOK');
        expect(oracleToken.attributes['tokens-rate']).to.equal('1000');
      });
    });

    describe('ethereum-indexer multiple contracts with incremental indexing', function () {
      let token, oracle;

      async function setup() {
        let factory = new JSONAPIFactory();
        token = await SampleToken.new();
        oracle = await Oracle.new();

        factory.addResource('data-sources', contractName)
          .withAttributes({
            'source-type': '@cardstack/ethereum',
            params: {
              jsonRpcUrls: [ "ws://localhost:7545" ],
              contract: {
                abi: token.abi,
                address: token.address,
                eventContentTriggers: {
                  Mint: ["sample-token-balance-ofs"],
                  Transfer: ["sample-token-balance-ofs"],
                }
              }
            },
          });

        factory.addResource('data-sources', 'oracle')
          .withAttributes({
            'source-type': '@cardstack/ethereum',
            params: {
              jsonRpcUrls: [ "ws://localhost:7545" ],
              contract: {
                abi: oracle.abi,
                address: oracle.address,
                eventContentTriggers: {
                  TokenAdded: ['oracle-tokens']
                }
              }
            },
          });

        env = await createDefaultEnvironment(`${__dirname}/..`, factory.getModels());
        eventIndexer = env.lookup(`plugin-services:${require.resolve('../cardstack/event-indexer')}`);
        ethereumClient = eventIndexer.ethereumClient;

        await waitForEthereumEvents(eventIndexer);
      }

      beforeEach(setup);
      afterEach(teardown);

      it('can index multiple contracts with past events', async function() {
        let tokenEvents = (await token.mint(accountOne, 100)).logs;
        let oracleEvents = (await oracle.addToken(token.address, 'TOK', 1000)).logs;

        await waitForEthereumEvents(eventIndexer);

        let { data: accountOneLedgerEntry } = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'sample-token-balance-ofs', accountOne);
        expect(accountOneLedgerEntry.attributes['mapping-number-value']).to.equal('100');

        let [ { transactionHash:mintEventId }, { transactionHash:transferEventId } ]  = tokenEvents;
        let [ { transactionHash:tokenAddedEventId } ]  = oracleEvents;

        let { data: mintEvent } = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'sample-token-mint-events', `${mintEventId}_0`);
        expect(mintEvent.attributes['mint-event-amount']).to.equal('100');
        let { data: transferEvent } = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'sample-token-transfer-events', `${transferEventId}_1`);
        expect(transferEvent.attributes['transfer-event-value']).to.equal('100');

        let { data: tokenAddedEvent } = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'oracle-token-added-events', `${tokenAddedEventId}_0`);
        expect(tokenAddedEvent.attributes['token-added-event-rate']).to.equal('1000');

        let { data: oracleToken } = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'oracle-tokens', token.address);
        expect(oracleToken.attributes['tokens-token-address']).to.equal(Web3.utils.toChecksumAddress(token.address));
        expect(oracleToken.attributes['tokens-token-symbol']).to.equal('TOK');
        expect(oracleToken.attributes['tokens-rate']).to.equal('1000');
      });
    });


    describe('ethereum-indexer can patch schema', function () {
      let token;

      async function setup() {
        let factory = new JSONAPIFactory();
        token = await SampleToken.new();

        await token.mint(accountOne, 100);
        await token.mint(accountThree, 100);

        let dataSource = factory.addResource('data-sources', contractName)
          .withAttributes({
            'source-type': '@cardstack/ethereum',
            params: {
              jsonRpcUrls: [ "ws://localhost:7545" ],
              contract: {
                abi: token.abi,
                address: token.address,
                indexingSkipIndicators: ["tokenFrozen"],
                eventContentTriggers: {
                  Transfer: ["sample-token-balance-ofs"],
                }
              },
              patch: {
                'content-types': {
                  'sample-token-balance-ofs': [{
                    op: 'add',
                    path: '/relationships/fields/data/-',
                    value: { type: 'computed-fields', id: 'utility-payment-amount' }
                  }]
                }
              }
            },
          });

        factory.addResource('computed-fields', 'utility-payment-amount').withAttributes({
          computedFieldType: 'sample-computed-fields::transfer-sum',
          params: {
            transferEvent: 'sample-token-transfer-events',
            transferAddressField: 'transfer-event-to',
            transferAddressValue: accountTwo,
            transferAmountField: 'transfer-event-value'
          }
        });

        contract = dataSource.data.attributes.params.contract,
          env = await createDefaultEnvironment(`${__dirname}/../../../tests/ethereum-computed-fields`, factory.getModels());

        eventIndexer = env.lookup(`plugin-services:${require.resolve('../cardstack/event-indexer')}`);
        ethereumClient = eventIndexer.ethereumClient;

        await waitForEthereumEvents(eventIndexer);
      }

      beforeEach(setup);
      afterEach(teardown);

      it('can patch schema with computed-fields', async function () {
        await token.transfer(accountTwo, 20, { from: accountOne });
        await token.transfer(accountThree, 10, { from: accountOne });
        await token.transfer(accountOne, 10, { from: accountTwo });
        await token.transfer(accountTwo, 30, { from: accountOne });
        await token.transfer(accountTwo, 20, { from: accountThree });

        await waitForEthereumEvents(eventIndexer);

        let accountOneBalance = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'sample-token-balance-ofs', accountOne);
        let accountThreeBalance = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'sample-token-balance-ofs', accountThree);

        expect(accountOneBalance.data.attributes['utility-payment-amount']).to.equal(50, 'utility-payment-amount computed field is correct');
        expect(accountThreeBalance.data.attributes['utility-payment-amount']).to.equal(20, 'utility-payment-amount computed field is correct');
      });
    });

    describe('ethereum-indexer for a large amount of past events', function () {
      let token;

      async function setup() {
        let factory = new JSONAPIFactory();
        token = await SampleToken.new();

        await token.mint(accountOne, 100);
        await token.transfer(accountTwo, 20, { from: accountOne });
        await token.transfer(accountThree, 30, { from: accountOne });
        await token.transfer(accountThree, 7, { from: accountTwo });

        for (let address of addresses) {
          await token.addBuyer(address);
        }

        factory.addResource('data-sources', contractName)
          .withAttributes({
            'source-type': '@cardstack/ethereum',
            params: {
              jsonRpcUrls: [ "ws://localhost:7545" ],
              contract: {
                abi: token.abi,
                address: token.address,
                eventContentTriggers: {
                  WhiteList: ["sample-token-approved-buyers"],
                  Transfer: ["sample-token-balance-ofs"],
                  Mint: ["sample-token-balance-ofs"]
                }
              }
            },
          });

        env = await createDefaultEnvironment(`${__dirname}/..`, factory.getModels());
        eventIndexer = env.lookup(`plugin-services:${require.resolve('../cardstack/event-indexer')}`);
        ethereumClient = eventIndexer.ethereumClient;

        await waitForEthereumEvents(eventIndexer);
      }

      beforeEach(setup);
      afterEach(teardown);

      it("can index a large amount of past events on the contract", async function () {
        let accountOneLedgerEntry = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'sample-token-balance-ofs', accountOne.toLowerCase());
        let accountTwoLedgerEntry = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'sample-token-balance-ofs', accountTwo.toLowerCase());
        let accountThreeLedgerEntry = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'sample-token-balance-ofs', accountThree.toLowerCase());
        let tokenRecord = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'sample-tokens', token.address);
        let events = await env.lookup('hub:searchers').search(env.session, { page: { size: 5000 }, filter: { type: 'sample-token-white-list-events' } });

        expect(tokenRecord.data.attributes["sample-token-buyer-count"]).to.equal("1000", "the buyer count is correct");
        expect(accountOneLedgerEntry.data.attributes["mapping-number-value"]).to.equal("50", "the token balance is correct");
        expect(accountTwoLedgerEntry.data.attributes["mapping-number-value"]).to.equal("13", "the token balance is correct");
        expect(accountThreeLedgerEntry.data.attributes["mapping-number-value"]).to.equal("37", "the token balance is correct");
        expect(events.data.length).to.equal(addresses.length, 'the correct number of whitelist event documents were created');

        for (let address of addresses) {
          let whitelistEntry = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'sample-token-approved-buyers', address.toLowerCase());
          expect(whitelistEntry.data.attributes["mapping-boolean-value"]).to.equal(true);
        }
      });
    });
  });
});

function toLowercase(object, path) {
  let value = get(object, path);
  if (!value) { return; }

  set(object, path, value.toLowerCase());
}
