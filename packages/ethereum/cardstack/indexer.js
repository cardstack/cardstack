const Ember = require('ember-source/dist/ember.debug');
const { dasherize } = Ember.String;
const { pluralize } = require('inflection');
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
        let model = await this.ethereumService.getContractInfo({ branch, type });
        await ops.save(model.type, model.id, model);
      }
    }

    if (!hints || !hints.length) {
      hints = await this.ethereumService.getPastEventsAsHints();
    }

    for (let { id, branch, type, contract, isContractType } of hints) {
      if (!branch || !type || !id || !contract || isContractType) { continue; }

      let contractAddress = this.contracts[contract].addresses[branch];
      let { data, methodName } = await this.ethereumService.getContractInfoFromHint({ id, type, branch, contract });
      let methodAbiEntry = this.contracts[contract]["abi"].find(item => item.type === 'function' &&
                                                                        item.constant &&
                                                                        item.name === methodName);
      let { isMapping, fields } = this._fieldTypeFor(contract, methodAbiEntry);
      if (!isMapping || !fields.length) { continue; }

      let model = {
        type,
        attributes: {
          'ethereum-address': id // preserve the case of the ID here to faithfully represent EIP-55 encoding
        },
        relationships: {}
      };

      if (typeof data === "object") {
        for (let returnName of Object.keys(data)) {
          let fieldName = `${dasherize(methodName)}-${dasherize(returnName)}`;
          if (!fields.find(field => field.name === fieldName)) { continue; }
          model.attributes[fieldName] = data[returnName];
        }
      } else {
        model.attributes[fields[0].name] = data;
      }

      model.relationships[`${contract}-contract`] = {
        data: { id: contractAddress, type: pluralize(contract) }
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
        let fieldInfo = this._fieldTypeFor(contractName, item);
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

  _fieldTypeFor(contractName, abiItem) {
    if (!abiItem.outputs || !abiItem.outputs.length) { return; }

    if (!abiItem.inputs.length) {
      // We are not handling multiple return types for non-mapping functions
      // unclear what that would actually look like in the schema...
      switch(abiItem.outputs[0].type) {
        // Using strings to represent uint256, as the max int
        // int in js is 2^53, vs 2^256 in solidity
        case 'uint256':
        case 'bytes32':
        case 'string':
        case 'address':
          return { fields: [{ type: '@cardstack/core-types::string' }]};
        case 'bool':
          return { fields: [{ type: '@cardstack/core-types::boolean' }]};
      }
    // deal with just mappings that use address as a key for now
    } else if (abiItem.inputs.length === 1 && abiItem.inputs[0].type === "address") {
      return {
        isMapping: true,
        fields: abiItem.outputs.map(output => {
          let name, type, isNamedField;
          if (output.name && abiItem.outputs.length > 1) {
            name = `${dasherize(abiItem.name)}-${dasherize(output.name)}`;
            isNamedField = true;
          }
          switch(output.type) {
            case 'uint256':
              name = name || `mapping-number-value`;
              type = 'number';
              break;
            case 'bool':
              name = name || `mapping-boolean-value`;
              type = 'boolean';
              break;
            case 'bytes32':
            case 'string':
            case 'address':
            default:
              name = name || `mapping-string-value`;
              type = 'string';
          }

          return { name, type, isNamedField };
        })
      };
    }
  }

}
