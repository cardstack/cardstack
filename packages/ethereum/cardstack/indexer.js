const { isEqual } = require('lodash');
const log = require('@cardstack/logger')('cardstack/ethereum/indexer');
const { declareInjections } = require('@cardstack/di');

module.exports = declareInjections({
  searcher: 'hub:searchers',
  ethereumService: `plugin-services:${require.resolve('./service')}`
},

class Indexer {

  static create(...args) {
    let [{ ethereumService, branches }] = args;
    ethereumService.connect(branches);
    return new this(...args);
  }

  constructor({ ethereumService, dataSource, branches, contracts, searcher }) {
    this.dataSourceId = dataSource.id;
    this.contracts = contracts;
    this.searcher = searcher;
    this._branches = branches;
    this.ethereumService = ethereumService;
  }

  async branches() {
    return Object.keys(this._branches);
  }

  async beginUpdate() {
    await this.ethereumService.start(this.contracts);

    return new Updater({
      dataSourceId: this.dataSourceId,
      contracts: this.contracts,
      ethereumService: this.ethereumService,
      searcher: this.searcher
    });
  }
});

class Updater {

  constructor({ dataSourceId, contracts, ethereumService, searcher }) {
    this.dataSourceId = dataSourceId;
    this.contracts = contracts;
    this.ethereumService = ethereumService;
    this.searcher = searcher;
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
    });

    log.debug(`Created schema for contracts: \n ${JSON.stringify(schema, null, 2)}`);
    this._schema = schema;

    return this._schema;
  }

  async updateContent(meta, hints, ops) {
    let schema = await this.schema();
    let isSchemaUnchanged;

    if (meta) {
      let { lastSchema } = meta;
      isSchemaUnchanged = isEqual(lastSchema, schema);
    }

    if (!isSchemaUnchanged) {
      await ops.beginReplaceAll();
      for (let model of schema) {
        await ops.save(model.type, model.id, model);
      }
    } else {
      await ops.beginReplaceAll();
    }

    let contractHints = hints && hints.length ? hints.filter(hint => hint.isContractType) : [];
    if (!contractHints.length) {
      for (let contract of Object.keys(this.contracts)) {
        for (let branch of Object.keys(this.contracts[contract].addresses)) {
          let model = await this.ethereumService.getContractInfo({ branch, contract });
          await ops.save(model.type, model.id, model);
        }
      }
    } else {
      for (let { branch, type } of contractHints) {
        let model = await this.ethereumService.getContractInfo({ branch, contract: type });
        await ops.save(model.type, model.id, model);
      }
    }

    if (!hints || !hints.length) {
      hints = await this.ethereumService.getPastEventsAsHints();
    }

    for (let { id, branch, type, contract, isContractType } of hints) {
      if (!branch || !type || !id || !contract || isContractType) { continue; }

      let contractAddress = this.contracts[contract].addresses[branch];
      let data = await this.ethereumService.getContractInfoFromHint({ id, type, branch, contract });
      let model = {
        type,
        attributes: {
          'ethereum-address': id, // preserve the case of the ID here to faithfully represent EIP-55 encoding
          'mapping-number-value': data,
        },
        relationships: {}
      };
      model.relationships[`${contract}-contract`] = {
        data: { id: contractAddress, type: contract }
      };

      await ops.save(type, id.toLowerCase(), model);
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

  _mappingFieldFor(contractName, fieldName, valueType) {
    return {
      type: "content-types",
      id: `${contractName}-${fieldName}`,
      relationships: {
        fields: {
          data: [
            { type: "fields", id: "ethereum-address" },
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
            { type: "content-types", id: contentType }
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
        let type = this._fieldTypeFor(contractName, item);
        if (!type) { return; }

        let field = {
          type: "fields",
          id: `${contractName}-${item.name}`,
        };

        if (type.indexOf("@") > -1) {
          field.attributes = { "field-type": type };
          fields.push(field);
        }

        if (type.indexOf('mapping') > -1) {
          let relatedField = this._belongsToFieldFor(contractName);
          if (!customTypes.find(field => field.id === relatedField.id)) {
            customTypes.push(relatedField);
          }
          let mappingField = this._mappingFieldFor(contractName, item.name, type);
          if (!customTypes.find(field => field.id === mappingField.id)) {
            customTypes.push(mappingField);
            customTypes.push(this._openGrantForContentType(`${contractName}-${item.name}`));
          }
        }
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
          return `mapping-number-value`;
        case 'bool':
          return `mapping-boolean-value`;
        case 'bytes32':
        case 'string':
        case 'address':
        default:
          return `mapping-string-value`;
      }
    }
  }

}
