module.exports = {
  valid(value, { relatedTypes }) {
    if (!value.hasOwnProperty('data') && !value.hasOwnProperty('links')) {
      return 'requires either a "data" or "links" property';
    }
    if (value.data && Array.isArray(value.data)) {
      return 'accepts only a single resource, not a list of resources';
    }
    if (relatedTypes && value.data && !relatedTypes[value.data.type]) {
      return `refers to disallowed type "${value.data.type}"`;
    }
    return true;
  },
  default: { data: null },
  isRelationship: true,
};
