const Ember = require('ember-source/dist/ember.debug');
const { dasherize } = Ember.String;
const { pluralize } = require('inflection');

function solidityTypeToInternalType(type) {
  switch(type) {
    case 'uint8':
    case 'uint16':
    case 'uint32':
    case 'uint64':
    case 'uint128':
    case 'uint256':
      return 'number';
    case 'bool':
      return 'boolean';
    case 'address':
      return 'address';
    case 'bytes32':
    case 'string':
    default:
      return 'string';
  }
}

function fieldTypeFor(abiItem) {
  if (!abiItem ||
      (abiItem.type === 'function' && !abiItem.outputs) ||
      (abiItem.type === 'function' && !abiItem.outputs.length)) { return; }

  if (abiItem.type === 'event') {
    let isNamedField = true;
    return {
      isEvent: true,
      fields: abiItem.inputs.map(input => {
        let type = solidityTypeToInternalType(input.type);
        let name = `${dasherize(abiItem.name)}-event-${dasherize(input.name.replace(/^_/, ''))}`;

        return { name, type, isNamedField };
      })
    };
  } else if (!abiItem.inputs.length) {
    // We are not handling multiple return types for non-mapping functions
    // unclear what that would actually look like in the schema...
    switch(abiItem.outputs[0].type) {
      // Using strings to represent uint256, as the max int
      // int in js is 2^53, vs 2^256 in solidity
      case 'uint8':
      case 'uint16':
      case 'uint32':
      case 'uint64':
      case 'uint128':
      case 'uint256':
      case 'bytes32':
      case 'string':
        return { fields: [{ type: '@cardstack/core-types::string' }]};
      case 'address':
        return { fields: [{ type: '@cardstack/core-types::case-insensitive' }]};
      case 'bool':
        return { fields: [{ type: '@cardstack/core-types::boolean' }]};
    }
  // deal with just mappings that use address and bytes32 as a key for now
  } else if (abiItem.inputs.length === 1 && ['address', 'bytes32'].includes(abiItem.inputs[0].type)) {
    return {
      isMapping: true,
      mappingKeyType: abiItem.inputs[0].type,
      fields: fieldsForMapping(abiItem)
    };
  // deal with only indexing has-many type relationships when there are 2 inputs and they have different types for now
  } else if (abiItem.inputs.length === 2 &&
    abiItem.inputs[0].type !== abiItem.inputs[1].type &&
    abiItem.inputs.map(i => i.type).every(i => ['address', 'bytes32'].includes(i))) {
    let fieldInfo = { hasMany: {} };

    for (let index = 0; index < 2; index++) {
      let input = abiItem.inputs[index];
      let inputName = input.name || input.type;
      let otherField = abiItem.inputs[(index + 1) % 2];
      let otherName = otherField.name || otherField.type;
      let otherChildContentType = `${dasherize(abiItem.name)}-${pluralize(dasherize(otherName.replace(/^_/, '')))}`;
      let inputContentType = `${dasherize(abiItem.name)}-by-${pluralize(dasherize(inputName.replace(/^_/, '')))}`;

      fieldInfo.hasMany[inputName] = {
        mappingKeyType: input.type,
        thisContentType: inputContentType,
        fields: fieldsForMapping(abiItem).concat([{
          mappingKeyType: otherField.type,
          name: otherChildContentType,
          type: 'has-many',
          isNamedField: true
        }])
      };
    }
    return fieldInfo;
  }
}

function fieldsForMapping(abiItem) {
  return abiItem.outputs.map(output => {
    let name, isNamedField;
    let type = solidityTypeToInternalType(output.type);
    if (output.name && abiItem.outputs.length > 1) {
      name = `${dasherize(abiItem.name)}-${dasherize(output.name.replace(/^_/, ''))}`;
      isNamedField = true;
    }
    switch (type) {
      case 'number':
        name = name || `mapping-number-value`;
        break;
      case 'boolean':
        name = name || `mapping-boolean-value`;
        break;
      case 'address':
        name = name || `mapping-address-value`;
        break;
      case 'string':
      default:
        name = name || `mapping-string-value`;
    }

    return { name, type, isNamedField };
  });
}

module.exports = {
  fieldTypeFor
};
