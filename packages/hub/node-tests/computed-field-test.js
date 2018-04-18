const JSONAPIFactory = require('../../../tests/sample-computed-fields/node_modules/@cardstack/test-support/jsonapi-factory');

const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('../../../tests/sample-computed-fields/node_modules/@cardstack/test-support/env');

describe('hub/computed-fields', function() {
  let env, apple;

  async function setup () {
    let factory = new JSONAPIFactory();

    factory.addResource('content-types', 'foods')
      .withRelated('fields', [
        factory.addResource('fields', 'title').withAttributes({
          fieldType: '@cardstack/core-types::string'
        }),
        factory.addResource('fields', 'weight-in-ounces').withAttributes({
          fieldType: '@cardstack/core-types::integer'
        }),
        factory.addResource('computed-fields', 'weight-in-grams').withAttributes({
          fieldType: 'sample-computed-fields::multiply-by-constant',
          params: {
            sourceField: 'weight-in-grams',
            factor: 28
          }
        })
      ]);

    apple = factory.addResource('foods').withAttributes({
      title: 'Apple',
      weightInOunces: 16
    });

    env = await createDefaultEnvironment(`${__dirname}/../../../tests/sample-computed-fields`, factory.getModels());
  }

  async function teardown() {
    await destroyDefaultEnvironment(env);
  }

  describe('read-only', function() {
    before(setup);
    after(teardown);

    it("supports computed fields", async function() {
      let model = await env.lookup('hub:searchers').get(env.session, 'master', 'foods', apple.id);
      expect(model.data).has.deep.property('attributes.weight-in-grams', 448);
    });
  });
});
