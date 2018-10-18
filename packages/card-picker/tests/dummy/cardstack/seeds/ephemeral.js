/* eslint-env node */
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

function initialModels() {
  let initial = new JSONAPIFactory();

  initial.addResource('content-types', 'generic-cards')
    .withRelated('fields', [
      initial.addResource('fields', 'name').withAttributes({
        fieldType: '@cardstack/core-types::string'
      })
    ]);

  initial.addResource('generic-cards', 'card-1').withAttributes({ name: 'Card #1' });
  initial.addResource('generic-cards', 'card-2').withAttributes({ name: 'Card #2' });
  initial.addResource('generic-cards', 'card-3').withAttributes({ name: 'Card #3' });
  initial.addResource('generic-cards', 'card-4').withAttributes({ name: 'Card #4' });

  initial.addResource('content-types', 'dummypages')
    .withAttributes({
      fieldsets: {
        isolated: [
          { field: 'cards', format: 'embedded' }
        ]
      }
    })
    .withRelated('fields', [
      initial.addResource('fields', 'cards').withAttributes({
        fieldType: '@cardstack/core-types::has-many',
        editorComponent: 'field-editors/cardstack-cards-editor'
      })
    ]);

  initial.addResource('dummypages', 'dummypage')
    .withAttributes({
      title: "Cardstack"
    })
    .withRelated('cards', [
      { type: 'generic-cards', id: 'card-1' },
      { type: 'generic-cards', id: 'card-2' },
      { type: 'generic-cards', id: 'card-3' },
      { type: 'generic-cards', id: 'card-4' }
    ]);

  return initial.getModels();
}

module.exports = initialModels();
