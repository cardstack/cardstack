/* eslint-env node */

const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

function initialModels() {
  let initial = new JSONAPIFactory();

  initial.addResource('content-types', 'pages')
  .withRelated('fields', [
      initial.addResource('fields', 'blurb').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
      initial.addResource('fields', 'permalink').withAttributes({
        fieldType: '@cardstack/core-types::string'
      })
    ]);
  initial.addResource('pages', 'page-homepage')
    .withAttributes({
      blurb: 'this is the homepage',
      permalink: ' '
    });
  initial.addResource('pages', 'page-second')
    .withAttributes({
      blurb: 'I am the second page',
      permalink: 'second'
    });

  initial.addResource('content-types', 'posts')
    .withAttributes({
      router: [{
        path: '/?foo=:foo&bee=:bee'
      }],
      fieldsets: {
        isolated: [{ field: 'page', format: 'embedded'}],
        embedded: [{ field: 'page', format: 'embedded'}]
      }
    })
    .withRelated('fields', [
      initial.addResource('fields', 'title').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
      initial.addResource('fields', 'page').withAttributes({
        fieldType: '@cardstack/core-types::belongs-to'
      }),
    ]);
  initial.addResource('posts', '1')
    .withAttributes({
      title: 'hello world'
    })
    .withRelated('page', { type: 'pages', id: 'page-second' });
  initial.addResource('posts', '2')
    .withAttributes({
      title: 'second post'
    })
    .withRelated('page', { type: 'pages', id: 'page-second' });

  initial.addResource('content-types', 'categories')
    .withAttributes({
      defaultIncludes: ['posts'],
      fieldsets: {
        isolated: [{ field: 'posts', format: 'embedded'}]
      }
    })
    .withRelated('fields', [
      initial.addResource('fields', 'title').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
      initial.addResource('fields', 'posts').withAttributes({
        fieldType: '@cardstack/core-types::has-many'
      })
    ]);
  initial.addResource('categories', 'category-1')
    .withAttributes({
      title: 'test category'
    })
    .withRelated('posts', [
      { type: 'posts', id: '1' },
      { type: 'posts', id: '2' }
    ]);

  return initial.getModels();
}

module.exports = initialModels();
