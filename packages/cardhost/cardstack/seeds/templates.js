const Factory = require('@cardstack/test-support/jsonapi-factory');

let locationFactory = new Factory();
let locationCardTemplate = locationFactory.getDocumentFor(
  locationFactory.addResource('cards', 'local-hub::location-card')
    .withRelated('adopted-from', { type: 'cards', id: 'local-hub::@cardstack/base-card' })
    .withRelated('fields', [
      locationFactory.addResource('fields', 'address').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        'needed-when-embedded': true,
        caption: 'Street Address'
      }),
      locationFactory.addResource('fields', 'address2').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        'needed-when-embedded': true,
        caption: 'Apt #/Unit'
      }),
      locationFactory.addResource('fields', 'city').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        'needed-when-embedded': true,
        caption: 'City'
      }),
      locationFactory.addResource('fields', 'state').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        'needed-when-embedded': true,
        caption: 'State'
      }),
      locationFactory.addResource('fields', 'zip').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        'needed-when-embedded': true,
        caption: 'Zip Code'
      }),
      locationFactory.addResource('fields', 'country').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        'needed-when-embedded': true,
        caption: 'Country'
      }),
    ])
    .withRelated('model', locationFactory.addResource('local-hub::location-card', 'local-hub::location-card')
      .withAttributes({
        address: "123 Main St.",
        city: "Anytown",
        state: "MA",
        zip: "12345",
        country: "USA"
      })
    )
);

module.exports = [ locationCardTemplate ];