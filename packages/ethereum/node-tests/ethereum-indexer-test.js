/* eslint-env node */

const tokenAbi = require("./contracts/simple-erc20-abi");
const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('@cardstack/test-support/env');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

describe('ethereum-indexer', function() {
  let env, dataSource;

  async function setup() {
    let factory = new JSONAPIFactory();

    dataSource = factory.addResource('data-sources')
      .withAttributes({
        'source-type': '@cardstack/ethereum',
        params: {
          branches: {
            master: {
              host: 'localhost',
              port: 8545,
              network_id: "*",
            }
          },
          contracts: {
            "sample-token": {
              abi: tokenAbi,
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
