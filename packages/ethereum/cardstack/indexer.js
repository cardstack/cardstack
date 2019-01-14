const Ember = require('ember-source/dist/ember.debug');
const { dasherize } = Ember.String;
const { pluralize } = require('inflection');
const { isEqual, get } = require('lodash');
const log = require('@cardstack/logger')('cardstack/ethereum/indexer');
const { declareInjections } = require('@cardstack/di');
const { fieldTypeFor } = require('./abi-utils');
const { apply_patch } = require('jsonpatch');

const defaultBranch = 'master';

module.exports = declareInjections({
  searchers: 'hub:searchers',
  controllingBranch: 'hub:controlling-branch',
  ethereumClient: `plugin-services:${require.resolve('./client')}`,
  eventIndexer: `plugin-services:${require.resolve('./event-indexer')}`,
  transactionIndexer: `plugin-services:${require.resolve('./transaction-indexer')}`
},

  class EthereumIndexer {

    static create(...args) {
      let [{ ethereumClient, jsonRpcUrl }] = args;
      ethereumClient.connect(jsonRpcUrl);
      return new this(...args);
    }

    constructor({ ethereumClient, dataSource, jsonRpcUrl, controllingBranch, contract, addressIndexing, patch, searchers, eventIndexer, transactionIndexer }) {
      this.dataSourceId = dataSource.id;
      this.contract = contract;
      this.addressIndexing = addressIndexing;
      this.searchers = searchers;
      this.eventIndexer = eventIndexer;
      this.transactionIndexer = transactionIndexer;
      this.controllingBranch = controllingBranch;
      this.patch = patch || Object.create(null);
      this._jsonRpcUrl = jsonRpcUrl;
      this.ethereumClient = ethereumClient;
    }

    async branches() {
      return [this.controllingBranch.name];
    }

    async beginUpdate() {
      if (this.contract) {
        await this.eventIndexer.start({
          ethereumClient: this.ethereumClient,
          name: this.dataSourceId,
          contract: this.contract
        });
      }

      if (this.addressIndexing) {
        await this.transactionIndexer.start(this.addressIndexing, this.ethereumClient);
      }

      return new Updater({
        dataSourceId: this.dataSourceId,
        contract: this.contract,
        addressIndexing: this.addressIndexing,
        eventIndexer: this.eventIndexer,
        transactionIndexer: this.transactionIndexer,
        patch: this.patch,
        searchers: this.searchers
      });
    }
  });

class Updater {

  constructor({ dataSourceId, contract, addressIndexing, searchers, transactionIndexer, eventIndexer, patch }) {
    this.dataSourceId = dataSourceId;
    this.contract = contract;
    this.addressIndexing = addressIndexing;
    this.searchers = searchers;
    this.eventIndexer = eventIndexer;
    this.transactionIndexer = transactionIndexer;
    this.patch = patch;
  }

  async schema() {
    if (this._schema) { return this._schema; }

    let defaultFields = [{
      type: "fields",
      id: "ethereum-address",
      attributes: {
        "field-type": "@cardstack/core-types::case-insensitive"
      }
    }, {
      type: "fields",
      id: "balance-wei",
      attributes: {
        "field-type": "@cardstack/core-types::string"
      }
    }, {
      type: "fields",
      id: "block-number",
      attributes: {
        "field-type": "@cardstack/core-types::integer"
      }
    }, {
      type: "fields",
      id: "event-name",
      attributes: {
        "field-type": "@cardstack/core-types::string"
      }
    }, {
      type: "fields",
      id: "mapping-boolean-value",
      attributes: {
        "field-type": "@cardstack/core-types::boolean"
      }
    }, {
      type: "fields",
      id: "mapping-string-value",
      attributes: {
        "field-type": "@cardstack/core-types::string"
      }
    }, {
      type: "fields",
      id: "mapping-address-value",
      attributes: {
        "field-type": "@cardstack/core-types::case-insensitive"
      }
    }, {
      type: "fields",
      id: "mapping-number-value",
      attributes: {
        "field-type": "@cardstack/core-types::string" // ethereum numbers are too large for JS, use a string to internally represent ethereum numbers
      }
    }, {
      type: "fields",
      id: "transaction-participants",
      attributes: {
        "field-type": "@cardstack/core-types::string-array"
      }
    }, {
      type: "fields",
      id: "block-data",
      attributes: {
        "field-type": "@cardstack/core-types::object"
      }
    }, {
      type: "fields",
      id: "transaction-hash",
      attributes: {
        "field-type": "@cardstack/core-types::integer"
      }
    }, {
      type: "fields",
      id: "block-hash",
      attributes: {
        "field-type": "@cardstack/core-types::string"
      }
    }, {
      type: "fields",
      id: "transaction-nonce",
      attributes: {
        "field-type": "@cardstack/core-types::integer"
      }
    }, {
      type: "fields",
      id: "transaction-index",
      attributes: {
        "field-type": "@cardstack/core-types::integer"
      }
    }, {
      type: "fields",
      id: "timestamp",
      attributes: {
        "field-type": "@cardstack/core-types::integer"
      }
    }, {
      type: "fields",
      id: "transaction-value",
      attributes: {
        "field-type": "@cardstack/core-types::string"
      }
    }, {
      type: "fields",
      id: "gas",
      attributes: {
        "field-type": "@cardstack/core-types::integer"
      }
    }, {
      type: "fields",
      id: "gas-price",
      attributes: {
        "field-type": "@cardstack/core-types::string"
      }
    }, {
      type: "fields",
      id: "transaction-data",
      attributes: {
        "field-type": "@cardstack/core-types::string"
      }
    }, {
      type: "fields",
      id: "balance",
      attributes: {
        "field-type": "@cardstack/core-types::string"
      }
    }, {
      type: "fields",
      id: "transaction-successful",
      attributes: {
        "field-type": "@cardstack/core-types::boolean"
      }
    }, {
      type: "fields",
      id: "gas-used",
      attributes: {
        "field-type": "@cardstack/core-types::integer"
      }
    }, {
      type: "fields",
      id: "cumulative-gas-used",
      attributes: {
        "field-type": "@cardstack/core-types::integer"
      }
    }, {
      type: "fields",
      id: "to-address",
      attributes: {
        "field-type": "@cardstack/core-types::belongs-to"
      },
      relationships: {
        'related-types': {
          data: [{ type: 'content-types', id: 'ethereum-addresses' }]
        }
      }
    }, {
      type: "fields",
      id: "from-address",
      attributes: {
        "field-type": "@cardstack/core-types::belongs-to"
      },
      relationships: {
        'related-types': {
          data: [{ type: 'content-types', id: 'ethereum-addresses' }]
        }
      }
    }, {
      type: "fields",
      id: "transactions",
      attributes: {
        "field-type": "@cardstack/core-types::has-many"
      },
    }, {
      type: 'content-types',
      id: 'blocks',
      relationships: {
        fields: {
          data: [
            { type: "fields", id: "block-number" },
            { type: "fields", id: "block-hash" },
            { type: "fields", id: "timestamp" },
            { type: "fields", id: "transaction-participants" },
            { type: "fields", id: "block-data" },
          ]
        },
        'data-source': {
          data: { type: 'data-sources', id: this.dataSourceId.toString() }
        }
      }
    }, {
      type: 'content-types',
      id: 'ethereum-transactions',
      relationships: {
        fields: {
          data: [
            { type: "fields", id: "block-number" },
            { type: "fields", id: "timestamp" },
            { type: "fields", id: "transaction-hash" },
            { type: "fields", id: "block-hash" },
            { type: "fields", id: "transaction-nonce" },
            { type: "fields", id: "transaction-index" },
            { type: "fields", id: "to-address" },
            { type: "fields", id: "from-address" },
            { type: "fields", id: "transaction-value" },
            { type: "fields", id: "gas" },
            { type: "fields", id: "gas-price" },
            { type: "fields", id: "transaction-data" },
            { type: "fields", id: "transaction-successful" },
            { type: "fields", id: "gas-used" },
            { type: "fields", id: "cumulative-gas-used" },
          ]
        },
        'data-source': {
          data: { type: 'data-sources', id: this.dataSourceId.toString() }
        }
      }
    }, {
      type: 'content-types',
      id: 'ethereum-addresses',
      attributes: {
        // cards should patch this schema in the data-source config for setting the fieldsets based on their specific scenarios
        'default-includes': [ 'transactions' ]
      },
      relationships: {
        fields: {
          data: [
            { type: "fields", id: "ethereum-address" }, // use this field to preserve the case of the ID to faithfully represent EIP-55 encoding
            { type: "fields", id: "balance" },
            { type: "fields", id: "transactions" },
          ]
        },
        'data-source': {
          data: { type: 'data-sources', id: this.dataSourceId.toString() }
        }
      }
    }, {
      type: 'grants',
      id: 'ethereum-address-indexing-grant',
      attributes: {
        'may-read-fields': true,
        'may-read-resource': true,
      },
      relationships: {
        who: {
          data: [{ type: 'groups', id: 'everyone' }]
        },
        types: {
          "data": [
            { type: "content-types", id: 'ethereum-addresses' },
            { type: "content-types", id: 'ethereum-transactions' }
          ]
        }
      }
    }];

    let schema = [].concat(defaultFields);
    if (this.contract) {
      let contractName = this.dataSourceId;
      let abi = this.contract["abi"];
      let { contractFields, schemaItems } = this._getSchemaFromAbi(contractName, abi);

      schema = schema.concat(schemaItems)
        .concat(contractFields);

      let contractSchema = {
        type: 'content-types',
        id: pluralize(contractName),
        relationships: {
          fields: {
            data: [
              { type: "fields", id: "ethereum-address" },
              { type: "fields", id: "balance-wei" }
            ]
          },
          'data-source': {
            data: { type: 'data-sources', id: this.dataSourceId.toString() }
          }
        }
      };

      contractFields.forEach(field => {
        contractSchema.relationships.fields.data.push({
          type: "fields", id: field.id
        });
      });

      schema.push(this._openGrantForContentType(contractName));
      schema.push(contractSchema);
      log.debug(`Created schema for contract ${contractName}: \n ${JSON.stringify(schema, null, 2)}`);
    }

    this._schema = schema.map(doc => this._maybePatch(doc));

    return this._schema;
  }

  async updateContent(meta, hints, ops) {
    let schema = await this.schema();
    let isSchemaUnchanged, blockHeight, indexedAddressesBlockHeight;
    let lastBlockHeight = get(meta, 'lastBlockHeight');
    let lastAddressesBlockHeight = get(meta, 'lastIndexedAddressesBlockHeight');

    if (meta) {
      let { lastSchema } = meta;
      isSchemaUnchanged = isEqual(lastSchema, schema);
    }

    if (!isSchemaUnchanged) {
      await ops.beginReplaceAll();
      for (let model of schema) {
        await ops.save(model.type, model.id, { data: model });
      }
      await ops.finishReplaceAll();
    }

    if (this.contract) {
      let shouldSkip = await this.eventIndexer.shouldSkipIndexing(this.dataSourceId, defaultBranch);
      blockHeight = lastBlockHeight;
      if (!shouldSkip) {
        let eventBlockHeight = await this.eventIndexer.getBlockHeight();
        if (!blockHeight || blockHeight < eventBlockHeight) {
          blockHeight = eventBlockHeight;
        }

        await this.eventIndexer.index(this.dataSourceId, lastBlockHeight);
      }
    }

    if (this.addressIndexing) {
      indexedAddressesBlockHeight = await this.transactionIndexer.index({
        lastIndexedBlockHeight: lastAddressesBlockHeight
      });
    }

    return {
      lastIndexedAddressesBlockHeight: indexedAddressesBlockHeight,
      lastBlockHeight: blockHeight,
      lastSchema: schema
    };
  }

  _maybePatch(doc) {
    let typePatches = this.patch[doc.type];
    if (typePatches) {
      let modelPatches = typePatches[doc.id];
      if (modelPatches) {
        doc = apply_patch(doc, modelPatches);
      }
    }
    return doc;
  }

  _namedFieldFor(fieldName, type) {
    let fieldType;
    switch (type) {
      // Using strings to represent uint256, as the max int
      // int in js is 2^53, vs 2^256 in solidity
      case 'boolean':
        fieldType = '@cardstack/core-types::boolean';
        break;
      case 'has-many':
        fieldType = '@cardstack/core-types::has-many';
        break;
      case 'address':
        fieldType = '@cardstack/core-types::case-insensitive';
        break;
      case 'number':
      case 'string':
      default:
        fieldType = '@cardstack/core-types::string';
    }
    return {
      type: 'fields',
      id: fieldName,
      attributes: {
        "field-type": fieldType
      }
    };
  }

  _belongsToFieldFor(contractName) {
    return {
      type: 'fields',
      id: contractName + '-contract',
      attributes: {
        "field-type": "@cardstack/core-types::belongs-to"
      },
      relationships: {
        "related-types": {
          "data": [
            { "type": "content-types", "id": pluralize(contractName) }
          ]
        },
      }
    };
  }

  _mappingContentTypeFor(contractName, mappingName, fields) {
    return {
      type: "content-types",
      id: pluralize(`${contractName}-${dasherize(mappingName)}`),
      relationships: {
        fields: {
          data: [
            { type: "fields", id: "ethereum-address" },
            { type: "fields", id: contractName + "-contract" }
          ].concat(fields.map(field => {
            return { type: "fields", id: field.name };
          }))
        },
        'data-source': {
          data: { type: 'data-sources', id: this.dataSourceId.toString() }
        }
      }
    };
  }

  _eventContentTypeFor(contractName, eventName, fields) {
    return {
      type: "content-types",
      id: pluralize(`${contractName}-${dasherize(eventName)}-events`),
      relationships: {
        fields: {
          data: [
            { type: "fields", id: "block-number" },
            { type: "fields", id: "transaction-hash" },
            { type: "fields", id: "event-name" },
            { type: "fields", id: contractName + "-contract" }
          ].concat(fields.map(field => {
            return { type: "fields", id: field.name };
          }))
        },
        'data-source': {
          data: { type: 'data-sources', id: this.dataSourceId.toString() }
        }
      }
    };
  }

  _openGrantForContentType(contentType) {
    return {
      type: 'grants',
      id: `${contentType}-grant`,
      attributes: {
        'may-read-fields': true,
        'may-read-resource': true,
      },
      relationships: {
        who: {
          data: [{ type: 'groups', id: 'everyone' }]
        },
        types: {
          "data": [
            { type: "content-types", id: pluralize(contentType) }
          ]
        }
      }
    };
  }

  _getSchemaFromAbi(contractName, abi) {
    let contractFields = [], schemaItems = [];
    abi.forEach(item => {
      if (item.type === "event" || (item.type === "function" && item.constant)) {
        let fieldInfo = fieldTypeFor(contractName, item);
        if (!fieldInfo) { return; }

        let { isEvent, isMapping, fields } = fieldInfo;
        if (!isMapping && !isEvent && fields.length === 1) {
          contractFields.push({
            type: "fields",
            id: `${contractName}-${dasherize(item.name)}`,
            attributes: { "field-type": fields[0]["type"] },
          });
          return;
        }

        for (let field of fields) {
          if (!field.isNamedField) { continue; }
          schemaItems.push(this._namedFieldFor(field.name, field.type));
        }

        let relatedField = this._belongsToFieldFor(contractName);
        if (!schemaItems.find(i => i.id === relatedField.id && i.type === 'fields')) {
          schemaItems.push(relatedField);
        }

        if (isMapping) {
          let mappingContentType = this._mappingContentTypeFor(contractName, item.name, fields);
          if (!schemaItems.find(i => i.id === mappingContentType.id && i.type === 'content-types')) {
            schemaItems.push(mappingContentType);
            schemaItems.push(this._openGrantForContentType(`${contractName}-${dasherize(item.name)}`));
          }
        } else if (isEvent) {
          schemaItems.push(this._namedFieldFor(`${contractName}-${dasherize(item.name)}-events`, 'has-many'));

          let eventContentType = this._eventContentTypeFor(contractName, item.name, fields);
          if (!schemaItems.find(i => i.id === eventContentType.id && i.type === 'content-types')) {
            schemaItems.push(eventContentType);
            schemaItems.push(this._openGrantForContentType(`${contractName}-${dasherize(item.name)}-events`));
          }
        }
      }
    });

    let eventContentTriggers = this.contract.eventContentTriggers || {};
    for (let event of Object.keys(eventContentTriggers)) {
      let eventField = `${contractName}-${dasherize(event)}-events`;
      let contentTypesToUpdate = eventContentTriggers[event];

      if (!contentTypesToUpdate.length) {
        let eventFieldIndex = schemaItems.findIndex(i => i.id === eventField && i.type === 'fields');
        if (eventFieldIndex < 0) { continue; }

        contractFields.push(schemaItems[eventFieldIndex]);
        schemaItems.splice(eventFieldIndex, 1);
      } else {
        for (let contentTypeName of contentTypesToUpdate) {
          let contentType = schemaItems.find(i => i.id === contentTypeName);
          if (!contentType) { continue; }

          contentType.relationships.fields.data.push({ type: 'fields', id: eventField });
        }
      }
    }

    return { contractFields, schemaItems };
  }

}
