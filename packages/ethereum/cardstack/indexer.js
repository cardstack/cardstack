const Ember = require('ember-source/dist/ember.debug');
const { dasherize } = Ember.String;
const { pluralize } = require('inflection');
const { isEqual, get } = require('lodash');
const log = require('@cardstack/logger')('cardstack/ethereum/indexer');
const { declareInjections } = require('@cardstack/di');
const { fieldTypeFor } = require('./abi-utils');
const { apply_patch } = require('jsonpatch');

const defaultBranch = 'master';

module.exports = declareInjections(
  {
    searcher: 'hub:searchers',
    ethereumClient: `plugin-services:${require.resolve('./client')}`,
    eventIndexer: `plugin-services:${require.resolve('./event-indexer')}`,
  },

  class Indexer {
    static create(...args) {
      let [{ ethereumClient, branches }] = args;
      ethereumClient.connect(branches);
      return new this(...args);
    }

    constructor({ ethereumClient, dataSource, branches, contract, patch, searcher, eventIndexer }) {
      this.dataSourceId = dataSource.id;
      this.contract = contract;
      this.searcher = searcher;
      this.eventIndexer = eventIndexer;
      this.patch = patch || Object.create(null);
      this._branches = branches;
      this.ethereumClient = ethereumClient;
    }

    async branches() {
      return Object.keys(this._branches);
    }

    async beginUpdate() {
      await this.eventIndexer.start({
        ethereumClient: this.ethereumClient,
        name: this.dataSourceId,
        contract: this.contract,
      });

      return new Updater({
        dataSourceId: this.dataSourceId,
        contract: this.contract,
        eventIndexer: this.eventIndexer,
        patch: this.patch,
        branches: await this.branches(),
        searcher: this.searcher,
      });
    }
  },
);

class Updater {
  constructor({ dataSourceId, contract, searcher, eventIndexer, patch, branches }) {
    this.dataSourceId = dataSourceId;
    this.contract = contract;
    this.searcher = searcher;
    this.eventIndexer = eventIndexer;
    this.patch = patch;
    this.branches = branches;
  }

  async schema() {
    if (this._schema) {
      return this._schema;
    }

    let defaultFields = [
      {
        type: 'fields',
        id: 'ethereum-address',
        attributes: {
          'field-type': '@cardstack/core-types::case-insensitive',
        },
      },
      {
        type: 'fields',
        id: 'balance-wei',
        attributes: {
          'field-type': '@cardstack/core-types::string',
        },
      },
      {
        type: 'fields',
        id: 'block-number',
        attributes: {
          'field-type': '@cardstack/core-types::integer',
        },
      },
      {
        type: 'fields',
        id: 'transaction-id',
        attributes: {
          'field-type': '@cardstack/core-types::integer',
        },
      },
      {
        type: 'fields',
        id: 'event-name',
        attributes: {
          'field-type': '@cardstack/core-types::string',
        },
      },
      {
        type: 'fields',
        id: 'mapping-boolean-value',
        attributes: {
          'field-type': '@cardstack/core-types::boolean',
        },
      },
      {
        type: 'fields',
        id: 'mapping-string-value',
        attributes: {
          'field-type': '@cardstack/core-types::string',
        },
      },
      {
        type: 'fields',
        id: 'mapping-address-value',
        attributes: {
          'field-type': '@cardstack/core-types::case-insensitive',
        },
      },
      {
        type: 'fields',
        id: 'mapping-number-value',
        attributes: {
          'field-type': '@cardstack/core-types::string', // ethereum numbers are too large for JS, use a string to internally represent ethereum numbers
        },
      },
    ];

    let schema = [].concat(defaultFields);
    let contractName = this.dataSourceId;
    let abi = this.contract['abi'];
    let { contractFields, schemaItems } = this._getSchemaFromAbi(contractName, abi);

    schema = schema.concat(schemaItems).concat(contractFields);

    let contractSchema = {
      type: 'content-types',
      id: pluralize(contractName),
      relationships: {
        fields: {
          data: [{ type: 'fields', id: 'ethereum-address' }, { type: 'fields', id: 'balance-wei' }],
        },
        'data-source': {
          data: { type: 'data-sources', id: this.dataSourceId.toString() },
        },
      },
    };

    contractFields.forEach(field => {
      contractSchema.relationships.fields.data.push({
        type: 'fields',
        id: field.id,
      });
    });

    schema.push(this._openGrantForContentType(contractName));
    schema.push(contractSchema);

    this._schema = schema.map(doc => this._maybePatch(doc));

    log.debug(`Created schema for contract ${contractName}: \n ${JSON.stringify(this.schema, null, 2)}`);

    return this._schema;
  }

  async updateContent(meta, hints, ops) {
    let schema = await this.schema();
    let isSchemaUnchanged;
    let lastBlockHeights = get(meta, 'lastBlockHeights');

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

    let shouldSkip = await this.eventIndexer.shouldSkipIndexing(this.dataSourceId, defaultBranch);
    let blockHeights = Object.assign({}, lastBlockHeights || {});
    if (!shouldSkip) {
      for (let branch of this.branches) {
        let blockheight = await this.eventIndexer.getBlockHeight(branch);
        if (!blockHeights[branch] || blockHeights[branch] < blockheight) {
          blockHeights[branch] = blockheight;
        }
      }

      await this.eventIndexer.index(this.dataSourceId, lastBlockHeights);
    }

    return {
      lastBlockHeights: blockHeights,
      lastSchema: schema,
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
        'field-type': fieldType,
      },
    };
  }

  _belongsToFieldFor(contractName) {
    return {
      type: 'fields',
      id: contractName + '-contract',
      attributes: {
        'field-type': '@cardstack/core-types::belongs-to',
      },
      relationships: {
        'related-types': {
          data: [{ type: 'content-types', id: pluralize(contractName) }],
        },
      },
    };
  }

  _mappingContentTypeFor(contractName, mappingName, fields) {
    return {
      type: 'content-types',
      id: pluralize(`${contractName}-${dasherize(mappingName)}`),
      relationships: {
        fields: {
          data: [{ type: 'fields', id: 'ethereum-address' }, { type: 'fields', id: contractName + '-contract' }].concat(
            fields.map(field => {
              return { type: 'fields', id: field.name };
            }),
          ),
        },
        'data-source': {
          data: { type: 'data-sources', id: this.dataSourceId.toString() },
        },
      },
    };
  }

  _eventContentTypeFor(contractName, eventName, fields) {
    return {
      type: 'content-types',
      id: pluralize(`${contractName}-${dasherize(eventName)}-events`),
      relationships: {
        fields: {
          data: [
            { type: 'fields', id: 'block-number' },
            { type: 'fields', id: 'transaction-id' },
            { type: 'fields', id: 'event-name' },
            { type: 'fields', id: contractName + '-contract' },
          ].concat(
            fields.map(field => {
              return { type: 'fields', id: field.name };
            }),
          ),
        },
        'data-source': {
          data: { type: 'data-sources', id: this.dataSourceId.toString() },
        },
      },
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
          data: [{ type: 'groups', id: 'everyone' }],
        },
        types: {
          data: [{ type: 'content-types', id: pluralize(contentType) }],
        },
      },
    };
  }

  _getSchemaFromAbi(contractName, abi) {
    let contractFields = [],
      schemaItems = [];
    abi.forEach(item => {
      if (item.type === 'event' || (item.type === 'function' && item.constant)) {
        let fieldInfo = fieldTypeFor(contractName, item);
        if (!fieldInfo) {
          return;
        }

        let { isEvent, isMapping, fields } = fieldInfo;
        if (!isMapping && !isEvent && fields.length === 1) {
          contractFields.push({
            type: 'fields',
            id: `${contractName}-${dasherize(item.name)}`,
            attributes: { 'field-type': fields[0]['type'] },
          });
          return;
        }

        for (let field of fields) {
          if (!field.isNamedField) {
            continue;
          }
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
        if (eventFieldIndex < 0) {
          continue;
        }

        contractFields.push(schemaItems[eventFieldIndex]);
        schemaItems.splice(eventFieldIndex, 1);
      } else {
        for (let contentTypeName of contentTypesToUpdate) {
          let contentType = schemaItems.find(i => i.id === contentTypeName);
          if (!contentType) {
            continue;
          }

          contentType.relationships.fields.data.push({ type: 'fields', id: eventField });
        }
      }
    }

    return { contractFields, schemaItems };
  }
}
