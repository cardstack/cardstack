/* eslint-env node */
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

function initialModels() {
  let initial = new JSONAPIFactory();

  initial.addResource('content-types', 'drivers')
  .withRelated('fields', [
    initial.addResource('fields', 'name').withAttributes({
      fieldType: '@cardstack/core-types::string'
    }),
    initial.addResource('fields', 'dob').withAttributes({
      fieldType: '@cardstack/core-types::date'
    }),
    initial.addResource('fields', 'feeling').withAttributes({
      fieldType: '@cardstack/core-types::belongs-to',
      editorComponent: 'field-editors/dropdown-choices-editor'
    }).withRelated('related-types', [
      initial.addResource('content-types', 'feelings')
        .withRelated('fields', [
          initial.addResource('fields', 'title').withAttributes({ fieldType: '@cardstack/core-types::string' })
      ])
    ])
  ]);

  let happyFeeling = initial.addResource('feelings', '1').withAttributes({ title: 'Happy' });
  initial.addResource('feelings', '2').withAttributes({ title: 'Sad' });
  initial.addResource('feelings', '3').withAttributes({ title: 'Exuberant' });
  initial.addResource('feelings', '4').withAttributes({ title: 'Melancholy' });

  initial.addResource('drivers', 'metalmario')
  .withAttributes({
    name: 'Metal Mario',
    dob: '1999-01-01'
  }).withRelated('feeling', happyFeeling);

  return initial.getModels();
}

module.exports = initialModels();
