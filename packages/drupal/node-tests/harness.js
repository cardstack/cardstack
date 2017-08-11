/* eslint-disable no-console */
const Indexer = require('../indexer');
const { createDefaultEnvironment } = require('@cardstack/test-support/env');
const PendingChange = require('@cardstack/plugin-utils/pending-change');

async function go() {
  let env = await createDefaultEnvironment(__dirname + '/../');
  let indexer = Indexer.create({
    url: 'http://localhost',
    dataSourceId: 'contenta',
    authToken: process.env.DRUPAL_TOKEN,
    nodeType: 'contentTypes',
    jsonapiExtrasEnabled: true
  });
  let updater = await indexer.beginUpdate('master');
  let schemaModels = await updater.schema();
  //console.log(JSON.stringify(schemaModels, null, 2));
  let schema = await env.lookup('hub:schema-loader').loadFrom(schemaModels);
  let create = new PendingChange(null, require('./sample-model')[0]);
  let errors = await schema.validationErrors(create, { session: env.session });
  console.log(errors);
}

go().then(() => process.exit(0), err => { console.log(err); process.exit(-1); });
