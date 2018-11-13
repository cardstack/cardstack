/* eslint-env node */

const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

function addConstraint(factory, constraint, field) {
  factory.addResource('constraints')
    .withAttributes({
      constraintType: constraint,
      inputs: { ignoreBlank: true }
    })
    .withRelated('input-assignments', [
      factory.addResource('input-assignments')
        .withAttributes({ inputName: 'target' })
        .withRelated('field', factory.getResource('fields', field)),
    ]);
}

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
      initial.addResource('fields', 'poster').withAttributes({
        fieldType: '@cardstack/core-types::belongs-to',
        owned: true,
      }).withRelated('related-types', [
        initial.getResource('content-types', 'bloggers')
      ]),
    ]);

  initial.addResource('content-types', 'posts')
    .withAttributes({
      defaultIncludes: ['author', 'comments', 'comments.poster', 'reading-time-unit']
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
      initial.addResource('fields', 'reading-time-unit').withAttributes({
        caption: 'Unit',
        fieldType: '@cardstack/core-types::belongs-to',
        editorComponent: 'field-editors/dropdown-choices-editor'
      }).withRelated('related-types', [
        initial.addResource('content-types', 'time-units')
          .withRelated('fields', [
            initial.addResource('fields', 'title')
              .withAttributes({ fieldType: '@cardstack/core-types::string' })
          ])
        ]),
      initial.addResource('fields', 'archived').withAttributes({
        fieldType: '@cardstack/core-types::boolean'
      }),
      initial.addResource('fields', 'category').withAttributes({
        fieldType: '@cardstack/core-types::string',
        editorComponent: 'field-editors/category-editor'
      }),
      initial.addResource('fields', 'comments').withAttributes({
        fieldType: '@cardstack/core-types::has-many',
        owned: true,
      }).withRelated('related-types', [
        initial.getResource('content-types', 'comments')
      ]),
      initial.addResource('fields', 'author').withAttributes({
        fieldType: '@cardstack/core-types::belongs-to',
      }).withRelated('related-types', [
        initial.getResource('content-types', 'bloggers')
      ]),
      initial.addResource('computed-fields', 'author-name').withAttributes({
        computedFieldType: '@cardstack/core-types::alias',
        params: {
          aliasPath: 'author.name',
        }
      }),
    ]);

    addConstraint(initial, '@cardstack/core-types::not-empty', 'title');
    addConstraint(initial, '@cardstack/core-types::not-empty', 'body');
    addConstraint(initial, '@cardstack/core-types::not-empty', 'category');

  let guybrush = initial.addResource('bloggers', '1')
    .withAttributes({
      name: 'Guybrush Threepwood'
    });

  let lechuck = initial.addResource('bloggers', '2')
    .withAttributes({
      name: 'LeChuck'
    });

  let threeHeadedMonkey = initial.addResource('comments', '1')
    .withAttributes({
      body: 'Look behind you, a Three-Headed Monkey!'
    })
    .withRelated('poster', guybrush);

  let doorstop = initial.addResource('comments', '2')
    .withAttributes({
      body: 'You’re about as fearsome as a doorstop.'
    })
    .withRelated('poster', guybrush);

  initial.addResource('time-units', '1')
    .withAttributes({ title: 'minutes' });
  initial.addResource('time-units', '2')
    .withAttributes({ title: 'hours' });
  initial.addResource('time-units', '3')
    .withAttributes({ title: 'days' });

  initial.addResource('posts', '1')
    .withAttributes({
      title: 'hello world',
      publishedAt: new Date(2017, 3, 24),
      category: 'adventure',
      archived: false,
      readingTimeValue: 8
    })
    .withRelated('reading-time-unit', { type: 'time-units', id: '1' })
    .withRelated('author', lechuck)
    .withRelated('comments', [ threeHeadedMonkey ]);

  initial.addResource('posts', '2')
    .withAttributes({
      title: 'second',
      publishedAt: new Date(2017, 9, 20),
      category: 'lifestyle',
      archived: true,
      readingTimeValue: 2
    })
    .withRelated('reading-time-unit', { type: 'time-units', id: '2' })
    .withRelated('author', lechuck)
    .withRelated('comments', [ doorstop ]);

  return initial.getModels();
}

module.exports = initialModels();

