/* eslint-env node */

module.exports = [

  {
    type: 'grants',
    id: 'wide-open',
    attributes: {
      'may-write-fields': true,
      'may-read-fields': true,
      'may-create-resource': true,
      'may-update-resource': true,
      'may-delete-resource': true,
      'may-read-resource': true
    },
    relationships: {
      who: {
        data: [{
          type: 'groups',
          id: 'everyone'
        }]
      }
    }
  }
];
