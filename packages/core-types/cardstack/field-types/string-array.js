let StringType = require('./string');

module.exports = {
  valid(value) {
    return Array.isArray(value) && value.every(item => StringType.valid(item));
  },

  // Arrays of primitive values in elasticsearch don't need any
  // special mapping. Every scalar type can also automatically be an
  // array, and it's all the same to Elasticsearch.
  defaultMapping: StringType.defaultMapping,
  sortFieldName: StringType.sortFieldName
};
