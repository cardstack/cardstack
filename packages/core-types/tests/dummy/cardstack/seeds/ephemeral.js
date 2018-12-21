/* eslint-env node */
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

function initialModels() {
  let initial = new JSONAPIFactory();


  initial.addResource('content-types', 'drivers')
  .withAttributes({
    defaultIncludes: [
      'feeling',
      'vehicle',
      'alternate-vehicle',
      'tracks'
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
    initial.addResource('fields', 'win-percentage').withAttributes({
      fieldType: '@cardstack/core-types::fixed-decimal'
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
    }).withRelated('related-types', [
      { type: 'content-types', id: 'vehicles' }
    ]),
    initial.addResource('fields', 'tracks').withAttributes({
      fieldType: '@cardstack/core-types::has-many',
      editorComponent: 'field-editors/dropdown-multi-select-editor',
    }).withRelated('related-types', [
      initial.addResource('content-types', 'tracks')
      .withRelated('fields', [
        initial.addResource('fields', 'title').withAttributes({ fieldType: '@cardstack/core-types::string' })
      ])
    ]),
    initial.addResource('fields', 'races').withAttributes({
      fieldType: '@cardstack/core-types::has-many',
      editorComponent: 'field-editors/dropdown-multi-select-editor',
      editorOptions: { displayFieldName: 'name' }
    }).withRelated('related-types', [
      initial.addResource('content-types', 'races')
        .withRelated('fields', [
          initial.addResource('fields', 'name').withAttributes({ fieldType: '@cardstack/core-types::string' })
        ])
    ])
  ]);

  let happyFeeling = initial.addResource('feelings', '1').withAttributes({ title: 'Happy' });
  let sadFeeling = initial.addResource('feelings', '2').withAttributes({ title: 'Sad' });
  let exuberantFeeling = initial.addResource('feelings', '3').withAttributes({ title: 'Exuberant' });
  initial.addResource('feelings', '4').withAttributes({ title: 'Melancholy' });

  let sportBikeVehicle = initial.addResource('vehicles', '1').withAttributes({ name: 'Sport Bike' });
  let standardKartVehicle = initial.addResource('vehicles', '2').withAttributes({ name: 'Standard Kart' });
  initial.addResource('vehicles', '3').withAttributes({ name: 'Honeycoupe' });
  initial.addResource('vehicles', '4').withAttributes({ name: 'Wild Wiggler' });

  let rainbowRoad = initial.addResource('tracks', 'rainbow-road').withAttributes({ title: 'Rainbow Road' });
  let sweetSweetCanyon = initial.addResource('tracks', 'sweet-sweet-canyon').withAttributes({ title: 'Sweet Sweet Canyon' });
  let koopaCity = initial.addResource('tracks', 'koopa-city').withAttributes({ title: 'Koopa City' });
  let twistedMansion = initial.addResource('tracks', 'twisted-mansion').withAttributes({ title: 'Twisted Mansion' });

  let race1 = initial.addResource('races', 'race-1').withAttributes({ name: 'Race 1' });
  let race2 = initial.addResource('races', 'race-2').withAttributes({ name: 'Race 2' });
  initial.addResource('races', 'race-3').withAttributes({ name: 'Race 3' });

  initial.addResource('drivers', 'kingboo')
    .withAttributes({
      name: 'King Boo',
      dob: '1998-01-21',
      latestVictory: '2018-10-24T13:56:05',
      winPercentage: 25.32,
      isGoodGuy: false
    })
    .withRelated('feeling', exuberantFeeling)
    .withRelated('vehicle', standardKartVehicle)
    .withRelated('tracks', [ twistedMansion ]);

    initial.addResource('drivers', 'metalmario')
    .withAttributes({
      name: 'Metal Mario',
      dob: '1999-01-01',
      latestVictory: '2018-10-25T13:56:05',
      winPercentage: 51.382,
      isGoodGuy: true
    })
    .withRelated('feeling', happyFeeling)
    .withRelated('vehicle', sportBikeVehicle)
    .withRelated('alternate-vehicle', standardKartVehicle)
    .withRelated('tracks', [ rainbowRoad, sweetSweetCanyon, koopaCity ])
    .withRelated('races', [ race1, race2 ]);

    initial.addResource('drivers', 'link')
    .withAttributes({
      name: 'Link',
      dob: '2003-01-01',
      latestVictory: '2018-10-23T13:56:05',
      winPercentage: 11.49,
      isGoodGuy: true
    })
    .withRelated('feeling', happyFeeling)
    .withRelated('vehicle', sportBikeVehicle);

    initial.addResource('drivers', 'shyguy')
    .withAttributes({
      name: 'Shy Guy',
      dob: '2001-01-01',
      winPercentage: 0,
      isGoodGuy: false
    })
    .withRelated('feeling', sadFeeling)
    .withRelated('vehicle', sportBikeVehicle);

  return initial.getModels();
}

module.exports = initialModels();
