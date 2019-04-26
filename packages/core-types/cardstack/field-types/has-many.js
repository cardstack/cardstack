module.exports = {
  valid(value, { relatedTypes }) {
    if (!value.hasOwnProperty('data') && !value.hasOwnProperty('links')) {
      return 'requires either a "data" or "links" property';
    }
    if (value.hasOwnProperty('data') && !Array.isArray(value.data)) {
      return 'accepts only a list of resources, not a single resource';
    }
    if (relatedTypes && value.data) {
      let disallowed = value.data.filter(ref => !relatedTypes[ref.type]);
      if (disallowed.length > 0) {
        return `refers to disallowed type(s) ${disallowed.map(d => `"${d.type}"`).join(', ')}`;
      }
    }
    return true;
  },
  default: { data: [] },
  isRelationship: true
};
