/* eslint-env node */

module.exports = [

  {
    type: 'grants',
    id: 'wide-open',
    attributes: {
      'may-read-fields': true,
      'may-write-fields': true,
      'may-create-resource': true,
      'may-update-resource': true,
      'may-delete-resource': true
    },
    relationships: {
      who: {
        data: { type: 'groups', id: 'everyone' }
      }
    }
  }
];
