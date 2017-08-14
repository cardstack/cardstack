/* eslint-disable no-console */
const Indexer = require('../indexer');
const { createDefaultEnvironment } = require('@cardstack/test-support/env');
const PendingChange = require('@cardstack/plugin-utils/pending-change');

const openAPIPatch = [
  {
    op: "add",
    path: "/definitions/node:recipe/properties/attributes/properties/difficulty/enum",
    value: ["easy", "medium", "hard"]
  },
  {
    op: "add",
    path: "/definitions/node:recipe/properties/type/enum",
    value: ["recipes"]
  },
  {
    op: "add",
    path: "/definitions/node:article/properties/type/enum",
    value: ["articles"]
  },
  {
    op: "add",
    path: "/definitions/node:page/properties/type/enum",
    value: ["pages"]
  },
  {
    op: "add",
    path: "/definitions/node:tutorial/properties/type/enum",
    value: ["node--tutorial"]
  }


];

async function go() {
  let env = await createDefaultEnvironment(__dirname + '/../');
  let indexer = Indexer.create({
    url: 'http://localhost',
    dataSourceId: 'contenta',
    authToken: process.env.DRUPAL_TOKEN,
    openAPIPatch
  });
  let updater = await indexer.beginUpdate('master');
  let schemaModels = await updater.schema();
  //console.log(JSON.stringify(schemaModels, null, 2));
  let oldSchema = await env.lookup('hub:schema-cache').schemaForBranch('master');
  let schema = await oldSchema.applyChanges(schemaModels.map(m => ({ id: m.id, type: m.type, document: m })));

  for (let model of require('./sample-model')) {
    let create = new PendingChange(null, model);
    let errors = await schema.validationErrors(create, { session: env.session });
    console.log(`${model.type} ${model.id} ${errors.length}`);
  }
}

async function login() {
  let request = require('superagent');
  let response = await request.post('http://localhost/oauth/token')
      .type('form')
      .send({
        client_id: '3e1a2872-e329-47f4-8447-3b4589744de6',
        client_secret: 'contenta',
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
