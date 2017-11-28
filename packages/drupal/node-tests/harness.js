/* eslint-disable no-console */
const { createDefaultEnvironment } = require('@cardstack/test-support/env');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

const openAPIPatch = [
  // Workaround for https://www.drupal.org/node/2902117
  {
    op: "add",
    path: "/definitions/node:recipe/properties/attributes/properties/difficulty/enum",
    value: ["easy", "medium", "hard"]
  },

  // Workaround for https://www.drupal.org/node/2902127
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
  },
  {
    op: "add",
    path: "/definitions/media:image/properties/type/enum",
    value: ["images"]
  },

  // Workaround for https://www.drupal.org/node/2902112
  {
    op: "replace",
    path: "/basePath",
    value: "/"
  }
];

async function go() {
  let factory = new JSONAPIFactory();
  factory.addResource('data-sources').withAttributes({
    'source-type': '@cardstack/drupal',
    params: {
      url: 'http://localhost',
      authToken: process.env.DRUPAL_TOKEN,
      openAPIPatch
    }
  });
  await createDefaultEnvironment(__dirname + '/../', factory.getModels());
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
