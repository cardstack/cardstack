/* eslint-disable no-console */
const Indexer = require('../indexer');
const { createDefaultEnvironment } = require('@cardstack/test-support/env');
const PendingChange = require('@cardstack/plugin-utils/pending-change');

async function go() {
  let env = await createDefaultEnvironment(__dirname + '/../');
  let indexer = Indexer.create({
    url: 'http://localhost',
    dataSourceId: 'contenta',
    authToken: process.env.DRUPAL_TOKEN
  });
  let updater = await indexer.beginUpdate('master');
  let schemaModels = await updater.schema();
  //console.log(JSON.stringify(schemaModels, null, 2));
  let oldSchema = await env.lookup('hub:schema-cache').schemaForBranch('master');
  let schema = await oldSchema.applyChanges(schemaModels.map(m => ({ id: m.id, type: m.type, document: m })));

  let create = new PendingChange(null, require('./sample-model')[0]);
  let errors = await schema.validationErrors(create, { session: env.session });
  console.log(errors);
}

async function login() {
  let request = require('superagent');
  let response = await request.post('http://localhost/oauth/token')
      .type('form')
      .send({
        client_id: '2fa12514-8ad3-43f3-ae67-9fe2967578b0',
        client_secret: 'cardstackcontenta',
        grant_type: 'password',
        username: 'edward',
        password: 'contenta'
      });
  process.stdout.write(`\n export DRUPAL_TOKEN=${response.body.access_token}\n\n`);
}

let main = go;
if (process.argv.includes("login")) {
  main = login;
}
main().then(() => process.exit(0), err => { console.log(err); process.exit(-1); });
