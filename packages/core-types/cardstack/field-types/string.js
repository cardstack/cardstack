module.exports = {
  valid(value) {
    return typeof value === 'string';
  },
  defaultMapping() {
    // we index this field twice. Once as "text", which is analyzed
    // for full-text search, and once as "keyword", which is better
    // for sorting and exact matches.
    return {
      type: "text",
      fields: {
        raw: {
          type: "keyword"
        }
      }
    };
  },
  // when sorting or exact matching, use the "keyword" typed sub field
  sortFieldName(fieldName) {
    return `${fieldName}.raw`;
  }
};
