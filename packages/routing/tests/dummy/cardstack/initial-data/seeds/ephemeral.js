/* eslint-env node */

const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

function initialModels() {
  let initial = new JSONAPIFactory();

  initial.addResource('content-types', 'posts')
    .withRelated('fields', [
      initial.addResource('fields', 'title').withAttributes({
        fieldType: '@cardstack/core-types::string'
      })
    ]);
  initial.addResource('posts', '1')
    .withAttributes({
      title: 'hello world'
    });
  initial.addResource('posts', '2')
    .withAttributes({
      title: 'second post'
    });

  initial.addResource('content-types', 'pages')
    .withRelated('fields', [
      initial.addResource('fields', 'blurb').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
      initial.addResource('fields', 'permalink').withAttributes({
        fieldType: '@cardstack/core-types::string'
      })
    ]);
  initial.addResource('pages')
    .withAttributes({
      blurb: 'this is the homepage',
      permalink: ' '
    });
  initial.addResource('pages')
    .withAttributes({
      blurb: 'I am the second page',
      permalink: 'second'
    });

  return initial.getModels();
}

module.exports = initialModels();
