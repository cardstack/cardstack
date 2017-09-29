module.exports = {
  valid(value, { relatedTypes }) {
    if (!value.hasOwnProperty('data')) {
      return 'has no "data" property';
    }
    if (Array.isArray(value.data)) {
      return 'accepts only a single resource, not a list of resources';
    }
    if (relatedTypes && value.data && !relatedTypes[value.data.type] ) {
      return `refers to disallowed type "${value.data.type}"`;
    }
    return true;
  },
  defaultMapping(allFields) {
    return {
      type: "object",
      properties: Object.assign(
        {},
        allFields.get('id').mapping(allFields),
        allFields.get('type').mapping(allFields)
      )
    };
  },
  default: { data: null },
  isRelationship: true
};
