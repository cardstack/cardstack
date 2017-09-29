module.exports = {
  valid(value, { relatedTypes }) {
    if (!value.hasOwnProperty('data')) {
      return 'has no "data" property';
    }
    if (!Array.isArray(value.data)) {
      return 'accepts only a list of resources, not a single resource';
    }
    if (relatedTypes) {
      let disallowed = value.data.filter(ref => !relatedTypes[ref.type]);
      if (disallowed.length > 0) {
        return `refers to disallowed type(s) ${disallowed.map(d => `"${d.type}"`).join(', ')}`;
      }
    }
    return true;
  },

  defaultMapping(allFields) {
    return {
      type: "nested",
      properties: Object.assign(
        {},
        allFields.get('id').mapping(allFields),
        allFields.get('type').mapping(allFields)
      )
    };
  },
  default: { data: [] },
  isRelationship: true
};
