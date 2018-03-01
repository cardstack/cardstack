const { isEqual } = require('lodash');
const log = require('@cardstack/logger')('cardstack/ethereum/indexer');

module.exports = class Indexer {

  static create(...args) {
    return new this(...args);
  }

  constructor({ dataSource, branches, contracts }) {
    this.dataSourceId = dataSource.id;
    this.networks = branches;
    this.contracts = contracts;
  }

  async branches() {
    // TODO load this from the config params
    return ['master'];
  }

  async beginUpdate() {
    return new Updater({
      dataSourceId: this.dataSourceId,
      contracts: this.contracts
    });
  }
};

class Updater {

  constructor({ dataSourceId, contracts }) {
    this.dataSourceId = dataSourceId;
    this.contracts = contracts;
  }

  async schema() {
    if (this._schema) { return this._schema; }

    let defaultFields = [{
      type: "fields",
      id: "contract-address",
      attributes: {
        "field-type": "@cardstack/core-types::string"
      }
    },{
      type: "fields",
      id: "mapping-address-key",
      attributes: {
        "field-type": "@cardstack/core-types::string"
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
    let contractNames = Object.keys(this.contracts);

    contractNames.forEach(contractName => {
      let abi = this.contracts[contractName]["abi"];
      let { fields, customTypes } = this._getFieldsFromAbi(contractName, abi);

      schema = schema.concat(customTypes)
                     .concat(fields);

      let contractSchema =  {
        type: 'content-types',
        id: contractName,
        relationships: {
          fields: {
            data: [
              { type: "fields", id: "contract-address" },
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

      schema.push(contractSchema);
    });

    log.debug(`Created schema for contracts: \n ${JSON.stringify(schema, null, 2)}`);
    this._schema = schema;

    return this._schema;
  }

  async updateContent(meta, hints, ops) {
    let schema = await this.schema();
    if (meta) {
      let { lastSchema } = meta;
      if (isEqual(lastSchema, schema)) {
        return;
      }
    }
    await ops.beginReplaceAll();
    for (let model of schema) {
      await ops.save(model.type, model.id, model);
    }

    await ops.finishReplaceAll();
    return {
      lastSchema: schema
    };
  }

  async read(type, id, isSchema) {
    if (isSchema) {
      return (await this.schema()).find(model => model.type === type && model.id === model.id);
    }
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
            { "type": "content-types", "id": contractName }
          ]
        },
      }
    };
  }

  _mappingFieldFor(contractName, mappingType) {
    let valueType = mappingType.replace(/^.*-mapping-(.*)-entry$/, "mapping-$1-value");
    return {
      type: "content-types",
      id: mappingType,
      relationships: {
        fields: {
          data: [
            { type: "fields", id: "mapping-address-key" },
            { type: "fields", id: valueType },
            { type: "fields", id: contractName + "-contract" }
          ]
        },
        'data-source': {
          data: { type: 'data-sources', id: this.dataSourceId.toString() }
        }
      }
    };
  }

  _getFieldsFromAbi(contractName, abi) {
    let fields = [];
    let customTypes = [];
    abi.forEach(item => {
      if (item.type === "function" && item.constant) {
        let type = this._fieldTypeFor(contractName, item);
        if (!type) { return; }

        let field = {
          type: "fields",
          id: `${contractName}-${item.name}`,
        };

        if (type.indexOf("@") > -1) {
          field.attributes = { "field-type": type };
        } else {
          field.attributes = { "field-type": "@cardstack/core-types::has-many" };
          field.relationships = {
            "related-types": {
              "data": [
                { "type": "content-types", "id": type }
              ]
            }
          };
        }

        if (type.indexOf('mapping') > -1) {
          let relatedField = this._belongsToFieldFor(contractName);
          if (!customTypes.find(field => field.id === relatedField.id)) {
            customTypes.push(relatedField);
          }
          let mappingField = this._mappingFieldFor(contractName, type);
          if (!customTypes.find(field => field.id === mappingField.id)) {
            customTypes.push(mappingField);
          }
        }

        fields.push(field);
      }
    });

    return { fields, customTypes };
  }

  _fieldTypeFor(contractName, abiItem) {
    if (!abiItem.outputs || !abiItem.outputs.length) { return; }


    if (!abiItem.inputs.length) {
      switch(abiItem.outputs[0].type) {
          // Using strings to represent uint256, as the max int
          // int in js is 2^53, vs 2^256 in solidity
        case 'uint256':
        case 'bytes32':
        case 'string':
        case 'address':
          return '@cardstack/core-types::string';
        case 'bool':
          return '@cardstack/core-types::boolean';
      }
    // deal with just mappings that use address as a key for now
    } else if (abiItem.inputs.length === 1 && abiItem.inputs[0].type === "address") {
      switch(abiItem.outputs[0].type) {
        case 'uint256':
          return `${contractName}-mapping-number-entry`;
        case 'bool':
          return `${contractName}-mapping-boolean-entry`;
        case 'bytes32':
        case 'string':
        case 'address':
        default:
          return `${contractName}-mapping-string-entry`;
      }
    }
  }

}
