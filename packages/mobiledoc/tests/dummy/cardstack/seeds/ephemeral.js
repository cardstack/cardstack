const Factory = require('@cardstack/test-support/jsonapi-factory');
const { createReadStream, readdirSync } = require('fs');
const path = require('path');

let factory = new Factory();

let models = [];
readdirSync(path.join(__dirname, './images')).forEach(filename => {
  let readStream = createReadStream(path.join(__dirname, 'images', filename));

  readStream.type = 'cardstack-files';
  readStream.id = filename.replace(/\..+/, '');
  let pathSegments = filename.split('/');
  readStream['filename'] = pathSegments[pathSegments.length - 1];

  models.push(readStream);

  models.forEach(file => {
    factory.addResource('cardstack-images', file.id)
    .withRelated('file', file);
  });
});

let grants = [
  {
    type: 'grants',
    id: 'wide-open',
    attributes: {
      'may-login': true,
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

module.exports = models.concat(factory.getModels()).concat(grants);
