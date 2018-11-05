/* eslint-env node */
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

function initialModels() {
  let initial = new JSONAPIFactory();


  initial.addResource('content-types', 'drivers')
  .withAttributes({
    defaultIncludes: [
      'feeling',
      'vehicle',
      'alternate-vehicle'
    ]
  })
  .withRelated('fields', [
    initial.addResource('fields', 'name').withAttributes({
      fieldType: '@cardstack/core-types::string'
    }),
    initial.addResource('fields', 'dob').withAttributes({
      fieldType: '@cardstack/core-types::date'
    }),
    initial.addResource('fields', 'latest-victory').withAttributes({
      fieldType: '@cardstack/core-types::date',
      editorComponent: 'field-editors/datetime-editor'
    }),
    initial.addResource('fields', 'is-good-guy').withAttributes({
      fieldType: '@cardstack/core-types::boolean'
    }),
    initial.addResource('fields', 'feeling').withAttributes({
      fieldType: '@cardstack/core-types::belongs-to',
      editorComponent: 'field-editors/dropdown-choices-editor'
    }).withRelated('related-types', [
      initial.addResource('content-types', 'feelings')
      .withRelated('fields', [
        initial.addResource('fields', 'title').withAttributes({ fieldType: '@cardstack/core-types::string' })
      ])
    ]),
    initial.addResource('fields', 'vehicle').withAttributes({
      fieldType: '@cardstack/core-types::belongs-to',
      editorComponent: 'field-editors/dropdown-choices-editor',
      editorOptions: { displayFieldName: 'name' }
    }).withRelated('related-types', [
      initial.addResource('content-types', 'vehicles')
      .withRelated('fields', [
        initial.addResource('fields', 'name').withAttributes({ fieldType: '@cardstack/core-types::string' })
      ])
    ]),
    initial.addResource('fields', 'alternate-vehicle').withAttributes({
      fieldType: '@cardstack/core-types::belongs-to',
      editorComponent: 'field-editors/dropdown-choices-editor',
      editorOptions: { displayFieldName: 'name' }
    }).withRelated('related-types', [{ type: 'content-types', id: 'vehicles' }]),
    initial.addResource('fields', 'allied-drivers').withAttributes({
      fieldType: '@cardstack/core-types::belongs-to',
      editorComponent: 'field-editors/advanced-search-editor',
      editorOptions: { displayFieldName: 'name' }
    })
  ]);

  let happyFeeling = initial.addResource('feelings', '1').withAttributes({ title: 'Happy' });
  let sadFeeling = initial.addResource('feelings', '2').withAttributes({ title: 'Sad' });
  let exuberantFeeling = initial.addResource('feelings', '3').withAttributes({ title: 'Exuberant' });
  initial.addResource('feelings', '4').withAttributes({ title: 'Melancholy' });

  let sportBikeVehicle = initial.addResource('vehicles', '1').withAttributes({ name: 'Sport Bike' });
  let standardKartVehicle = initial.addResource('vehicles', '2').withAttributes({ name: 'Standard Kart' });
  initial.addResource('vehicles', '3').withAttributes({ name: 'Honeycoupe' });
  initial.addResource('vehicles', '4').withAttributes({ name: 'Wild Wiggler' });


  initial.addResource('drivers', 'kingboo')
    .withAttributes({
      name: 'King Boo',
      dob: '1998-01-21',
      latestVictory: '2018-10-24T13:56:05',
      isGoodGuy: false
    })
    .withRelated('feeling', exuberantFeeling)
    .withRelated('vehicle', standardKartVehicle);

    initial.addResource('drivers', 'metalmario')
    .withAttributes({
      name: 'Metal Mario',
      dob: '1999-01-01',
      latestVictory: '2018-10-25T13:56:05',
      isGoodGuy: true
    })
    .withRelated('feeling', happyFeeling)
    .withRelated('vehicle', sportBikeVehicle)
    .withRelated('alternate-vehicle', standardKartVehicle);

    initial.addResource('drivers', 'link')
    .withAttributes({
      name: 'Link',
      dob: '2003-01-01',
      latestVictory: '2018-10-23T13:56:05',
      isGoodGuy: true
    })
    .withRelated('feeling', happyFeeling)
    .withRelated('vehicle', sportBikeVehicle);

    initial.addResource('drivers', 'shyguy')
    .withAttributes({
      name: 'Shy Guy',
      dob: '2001-01-01',
      isGoodGuy: false
    })
    .withRelated('feeling', sadFeeling)
    .withRelated('vehicle', sportBikeVehicle);

  return initial.getModels();
}

module.exports = initialModels();
