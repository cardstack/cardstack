const SampleToken = artifacts.require("./SampleToken.sol");
const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('@cardstack/test-support/env');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

contract('SampleToken', function(accounts) {
  describe('private blockchain sanity checks', function() {
    it("should mint SampleToken in the token owner account", async function() {
      let instance = await SampleToken.new();
      await instance.mint(accounts[0], 10000);
      let balance = await instance.balanceOf(accounts[0]);

      expect(balance.toNumber()).to.equal(10000, "the owner account balance is correct");
    });

    it("should transfer the token", async function() {
      // Get initial balances of first and second account.
      let account_one = accounts[0];
      let account_two = accounts[1];

      let amount = 10;

      let token = await SampleToken.new();
      await token.mint(account_one, 100);
      let account_one_starting_balance = await token.balanceOf(account_one);
      account_one_starting_balance = account_one_starting_balance.toNumber();

      let account_two_starting_balance = await token.balanceOf(account_two);
      account_two_starting_balance = account_two_starting_balance.toNumber();

      let txn = await token.transfer(account_two, amount, {from: account_one});
      let account_one_ending_balance = await token.balanceOf(account_one);
      account_one_ending_balance = account_one_ending_balance.toNumber();
      let account_two_ending_balance = await token.balanceOf(account_two);
      account_two_ending_balance = account_two_ending_balance.toNumber();

      expect(account_one_ending_balance).to.equal(account_one_starting_balance - amount, "Amount wasn't correctly taken from the sender");
      expect(account_two_ending_balance).to.equal(account_two_starting_balance + amount, "Amount wasn't correctly sent to the receiver");

      expect(txn.logs.length).to.equal(1, "there is one event fired");
      expect(txn.logs[0].event).to.equal("Transfer", "A transfer event is fired");
      expect(txn.logs[0].args.from).to.equal(account_one, "the sender address is correct");
      expect(txn.logs[0].args.to).to.equal(account_two, "the sender address is correct");
      expect(txn.logs[0].args.value.toNumber()).to.equal(amount, "the amount of tokens is correct");
    });
  });

  describe('ethereum-indexer', function() {
    let env, dataSource;

    async function setup() {
      let factory = new JSONAPIFactory();
      let token = await SampleToken.new();

      dataSource = factory.addResource('data-sources')
        .withAttributes({
          'source-type': '@cardstack/ethereum',
          params: {
            branches: {
              master: {
                host: 'localhost',
                port: 9545,
                network_id: "*",
              }
            },
            contracts: {
              "sample-token": {
                abi: token.abi,
                location: {
                  network: "testrpc",
                  address: ""
                },
              }
            }
          },
        });

      env = await createDefaultEnvironment(`${__dirname}/..`, factory.getModels());
    }

    async function teardown() {
      await destroyDefaultEnvironment(env);
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
                  "id": "contract-address"
                },
                {
                  "type": "fields",
                  "id": "balance-wei"
                },
                {
                  "id": "sample-token-mintingFinished",
                  "type": "fields"
                },
                {
                  "type": "fields",
                  "id": "sample-token-name"
                },
                {
                  "type": "fields",
                  "id": "sample-token-totalSupply"
                },
                {
                  "type": "fields",
                  "id": "sample-token-balanceOf"
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

      schema = await env.lookup('hub:searchers').get(env.session, 'master', 'content-types', 'sample-token-mapping-number-entry');
      expect(schema).to.deep.equal({
        "data": {
          "type": "content-types",
          "id": "sample-token-mapping-number-entry",
          "relationships": {
            "fields": {
              "data": [
                {
                  "type": "fields",
                  "id": "mapping-address-key"
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

      schema = await env.lookup('hub:searchers').get(env.session, 'master', 'fields', 'sample-token-balanceOf');
      expect(schema).to.deep.equal({
        "data": {
          "type": "fields",
          "id": "sample-token-balanceOf",
          "attributes": {
            "field-type": "@cardstack/core-types::has-many"
          },
          "relationships": {
            "related-types": {
              "data": [
                {
                  "type": "content-types",
                  "id": "sample-token-mapping-number-entry"
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

      schema = await env.lookup('hub:searchers').get(env.session, 'master', 'fields', 'sample-token-mintingFinished');
      expect(schema).to.deep.equal({
        "data": {
          "type": "fields",
          "id": "sample-token-mintingFinished",
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

      schema = await env.lookup('hub:searchers').get(env.session, 'master', 'fields', 'sample-token-totalSupply');
      expect(schema).to.deep.equal({
        "data": {
          "type": "fields",
          "id": "sample-token-totalSupply",
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
  });
});
