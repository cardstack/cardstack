/* eslint-env node */

const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

function initialModels() {
  let initial = new JSONAPIFactory();

  initial.addResource('content-types', 'bloggers')
    .withRelated('fields', [
      initial.addResource('fields', 'name').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
    ]);

  initial.addResource('content-types', 'comments')
    .withRelated('fields', [
      initial.addResource('fields', 'body').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
      initial.addResource('fields', 'author').withAttributes({
        fieldType: '@cardstack/core-types::belongs-to',
        owned: true,
      }).withRelated('related-types', [
        initial.getResource('content-types', 'bloggers')
      ]),
    ]);

  initial.addResource('content-types', 'posts')
    .withAttributes({
      defaultIncludes: ['comments', 'comments.author']
    })
    .withRelated('fields', [
      initial.addResource('fields', 'title').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
      initial.addResource('fields', 'published-at').withAttributes({
        caption: 'Publish Date',
        fieldType: '@cardstack/core-types::date'
      }),
      initial.addResource('fields', 'reading-time-value').withAttributes({
        caption: 'Value',
        fieldType: '@cardstack/core-types::integer'
      }),
      initial.addResource('fields', 'reading-time-units').withAttributes({
        caption: 'Units',
        fieldType: '@cardstack/core-types::string'
      }),
      initial.addResource('fields', 'archived').withAttributes({
        fieldType: '@cardstack/core-types::boolean'
      }),
      initial.addResource('fields', 'comments').withAttributes({
        fieldType: '@cardstack/core-types::has-many',
        owned: true,
      }).withRelated('related-types', [
        initial.getResource('content-types', 'comments')
      ]),
    ]);

    initial.addResource('constraints')
      .withAttributes({
        constraintType: '@cardstack/core-types::not-empty',
        inputs: { ignoreBlank: true }
      })
      .withRelated('input-assignments', [
        initial.addResource('input-assignments')
          .withAttributes({ inputName: 'target' })
          .withRelated('field', initial.getResource('fields', 'title')),
      ]);

    initial.addResource('constraints')
      .withAttributes({
        constraintType: '@cardstack/core-types::not-empty',
        inputs: { ignoreBlank: true }
      })
      .withRelated('input-assignments', [
        initial.addResource('input-assignments')
          .withAttributes({ inputName: 'target' })
          .withRelated('field', initial.getResource('fields', 'body')),
      ]);

  let guybrush = initial.addResource('bloggers', '1')
    .withAttributes({
      name: 'Guybrush Threepwood'
    });

  let threeHeadedMonkey = initial.addResource('comments', '1')
    .withAttributes({
      body: 'Look behind you, a Three-Headed Monkey!'
    })
    .withRelated('author', guybrush);

  let doorstop = initial.addResource('comments', '2')
    .withAttributes({
      body: 'You’re about as fearsome as a doorstop.'
    })
    .withRelated('author', guybrush);

  initial.addResource('posts', '1')
    .withAttributes({
      title: 'hello world',
      publishedAt: new Date(2017, 3, 24),
      readingTimeValue: 8,
      readingTimeUnits: 'minutes',
      archived: false
    })
    .withRelated('comments', [ threeHeadedMonkey ]);

  initial.addResource('posts', '2')
    .withAttributes({
      title: 'second',
      publishedAt: new Date(2017, 9, 20),
      readingTimeValue: 2,
      readingTimeUnits: 'hours',
      archived: true
    })
    .withRelated('comments', [ doorstop ]);

  return initial.getModels();
}

module.exports = initialModels();

