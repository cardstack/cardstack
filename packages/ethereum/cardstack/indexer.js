const Ember = require('ember-source/dist/ember.debug');
const { dasherize } = Ember.String;
const { pluralize } = require('inflection');
const { isEqual, get } = require('lodash');
const log = require('@cardstack/logger')('cardstack/ethereum/indexer');
const { declareInjections } = require('@cardstack/di');
const { fieldTypeFor } = require('./abi-utils');

module.exports = declareInjections({
  searcher: 'hub:searchers',
  ethereumService: `plugin-services:${require.resolve('./service')}`,
  buffer: `plugin-services:${require.resolve('./buffer')}`
},

class Indexer {

  static create(...args) {
    let [{ ethereumService, branches }] = args;
    ethereumService.connect(branches);
    return new this(...args);
  }

  constructor({ ethereumService, dataSource, branches, contract, searcher, buffer }) {
    this.dataSourceId = dataSource.id;
    this.contract = contract;
    this.searcher = searcher;
    this.buffer = buffer;
    this._branches = branches;
    this.ethereumService = ethereumService;
  }

  async branches() {
    return Object.keys(this._branches);
  }

  async beginUpdate() {
    await this.buffer.start({
      ethereumService: this.ethereumService,
      name: this.dataSourceId,
      contract: this.contract
    });

    return new Updater({
      dataSourceId: this.dataSourceId,
      contract: this.contract,
      buffer: this.buffer,
      searcher: this.searcher
    });
  }
});

class Updater {

  constructor({ dataSourceId, contract, searcher, buffer }) {
    this.dataSourceId = dataSourceId;
    this.contract = contract;
    this.searcher = searcher;
    this.buffer = buffer;
  }

  async schema() {
    if (this._schema) { return this._schema; }

    let defaultFields = [{
      type: "fields",
      id: "ethereum-address",
      attributes: {
        "field-type": "@cardstack/core-types::case-insensitive"
      }
    },{
      type: "fields",
      id: "balance-wei",
      attributes: {
        "field-type": "@cardstack/core-types::string"
      }
    },{
      type: "fields",
      id: "mapping-boolean-value",
      attributes: {
        "field-type": "@cardstack/core-types::boolean"
      }
    },{
      type: "fields",
      id: "mapping-string-value",
      attributes: {
        "field-type": "@cardstack/core-types::string"
      }
    },{
      type: "fields",
      id: "mapping-number-value",
      attributes: {
        "field-type": "@cardstack/core-types::string" // ethereum numbers are too large for JS, use a string to internally represent ethereum numbers
      }
    }];

    let schema = [].concat(defaultFields);
    let contractName = this.dataSourceId;
    let abi = this.contract["abi"];
    let { fields, customTypes } = this._getFieldsFromAbi(contractName, abi);

    schema = schema.concat(customTypes)
                   .concat(fields);

    let contractSchema =  {
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

    fields.forEach(field => {
      contractSchema.relationships.fields.data.push({
        type: "fields", id: field.id
      });
    });

    schema.push(this._openGrantForContentType(contractName));
    schema.push(contractSchema);

    log.debug(`Created schema for contract ${contractName}: \n ${JSON.stringify(schema, null, 2)}`);
    this._schema = schema;

    return this._schema;
  }

  async updateContent(meta, hints, ops) {
    let schema = await this.schema();
    let isSchemaUnchanged;
    let blockHeights = Object.assign({}, get(meta, 'lastBlockHeights') || {});
    let needsFinishReplaceAll;

    if (meta) {
      let { lastSchema } = meta;
      isSchemaUnchanged = isEqual(lastSchema, schema);
    }

    if (!isSchemaUnchanged) {
      needsFinishReplaceAll = true;
      await ops.beginReplaceAll();
    }

    for (let model of schema) {
      await ops.save(model.type, model.id, model);
    }

    let models = await this.buffer.readModels(this.dataSourceId, blockHeights, hints);

    for (let model of models) {
      let { blockheight, branch } = model.meta;
      if (!blockHeights[branch] || blockHeights[branch] < blockheight) {
        blockHeights[branch] = blockheight;
      }

      await ops.save(model.type, model.id, model);
    }

    if (needsFinishReplaceAll) {
      await ops.finishReplaceAll();
    }

    return {
      lastBlockHeights: blockHeights,
      lastSchema: schema
    };
  }

  async read(type, id, isSchema) {
    if (isSchema) {
      return (await this.schema()).find(model => model.type === type && model.id === model.id);
    }

    return await this.buffer.readModel({ type, id });
  }

  _namedFieldFor(fieldName, type) {
    let fieldType;
    switch(type) {
      // Using strings to represent uint256, as the max int
      // int in js is 2^53, vs 2^256 in solidity
      case 'boolean':
        fieldType = '@cardstack/core-types::boolean';
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

  _mappingFieldFor(contractName, fieldName, fields) {
    return {
      type: "content-types",
      id: pluralize(`${contractName}-${dasherize(fieldName)}`),
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
          data: { type: 'groups', id: 'everyone' }
        },
        types: {
          "data": [
            { type: "content-types", id: pluralize(contentType) }
          ]
        }
      }
    };
  }

  _getFieldsFromAbi(contractName, abi) {
    let fields = [];
    let customTypes = [];
    abi.forEach(item => {
      if (item.type === "function" && item.constant) {
        let fieldInfo = fieldTypeFor(contractName, item);
        if (!fieldInfo) { return; }
        let { isMapping, fields:nestedFields } = fieldInfo;

        let field = {
          type: "fields",
          id: `${contractName}-${dasherize(item.name)}`,
        };

        if (!isMapping && nestedFields.length === 1) {
          field.attributes = { "field-type": nestedFields[0]["type"] };
          fields.push(field);
        }

        if (isMapping) {
          for (let mappingField of nestedFields) {
            if (!mappingField.isNamedField) { continue; }
            customTypes.push(this._namedFieldFor(mappingField.name, mappingField.type));
          }

          let relatedField = this._belongsToFieldFor(contractName);
          if (!customTypes.find(field => field.id === relatedField.id)) {
            customTypes.push(relatedField);
          }

          let mappingField = this._mappingFieldFor(contractName, item.name, nestedFields);
          if (!customTypes.find(field => field.id === mappingField.id)) {
            customTypes.push(mappingField);
            customTypes.push(this._openGrantForContentType(`${contractName}-${dasherize(item.name)}`));
          }
        }
      }
    });

    return { fields, customTypes };
  }

}
