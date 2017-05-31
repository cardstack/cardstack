/* eslint-env node */
module.exports = {
  normalizeEntityName: function() {
    // this prevents an error when the entityName is
    // not specified (since that doesn't actually matter
    // to us
  },

  description: 'Generate initial seed model to activate @cardstack/jsonapi.'
};
