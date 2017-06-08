/* eslint-env node */
module.exports = {
  normalizeEntityName: function() {
    // this prevents an error when the entityName is
    // not specified (since that doesn't actually matter
    // to us
  },

  description: 'Grant full admin powers by default in development.'
};
