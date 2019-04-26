
export default function(factory, /*opts*/) {
  factory.addResource('content-types', 'locations')
    .withRelated('fields', [
      factory.addResource('fields', 'city').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
    ]);

  factory.addResource('locations', 'nyc')
    .withAttributes({
      city: 'New York City',
    });
}
