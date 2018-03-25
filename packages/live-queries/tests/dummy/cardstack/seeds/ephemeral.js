/* eslint-env node */
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

function initialModels() {
  let factory = new JSONAPIFactory();

  /*
  factory.addResource('items')
    .withAttributes({
      content: 'hello'
    });
  */

  return factory.getModels()
}

module.exports = initialModels();
