const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

const { readdirSync, existsSync } = require('fs');
const { join } = require('path');
const cardDir = join(__dirname, '../../../../../');

let factory = new JSONAPIFactory();
for (let cardName of readdirSync(cardDir)) {
  let schemaFile = join(cardDir, cardName, 'cardstack', 'static-model.js');
  if (!existsSync(schemaFile)) { continue; }

  factory.importModels(require(schemaFile)());
}

module.exports = factory.getModels();