/* eslint-env node */

module.exports = [

  // This grant doesn't have a user attached, so it applies to _everyone_.
  {
    type: 'grants',
    id: '0',
    attributes: {
      'may-write-field': true,
      'may-read-fields': true,
      'may-create-resource': true,
      'may-update-resource': true,
      'may-delete-resource': true
    }
  }
];
