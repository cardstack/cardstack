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
        factory.addResource('fields', 'nutrients').withAttributes({
          fieldType: '@cardstack/core-types::any'
        }),
        factory.addResource('fields', 'weight-in-ounces').withAttributes({
          fieldType: '@cardstack/core-types::integer'
        }),
        factory.addResource('computed-fields', 'weight-in-grams').withAttributes({
          computedFieldType: 'sample-computed-fields::multiply-by-constant',
          params: {
            sourceField: 'weight-in-ounces',
            factor: 28
          }
        }),
        factory.addResource('computed-fields', 'weight-in-milligrams').withAttributes({
          computedFieldType: 'sample-computed-fields::multiply-by-constant',
          params: {
            sourceField: 'weight-in-grams',
            factor: 1000
          }
        }),
        factory.addResource('computed-fields', 'echo-title').withAttributes({
          computedFieldType: 'sample-computed-fields::identity',
          params: {
            sourceField: 'title'
          }
        }),
        factory.addResource('computed-fields', 'echo-id').withAttributes({
          computedFieldType: 'sample-computed-fields::identity',
          params: {
            sourceField: 'id'
          }
        }),
        factory.addResource('computed-fields', 'echo-nutrients').withAttributes({
          computedFieldType: 'sample-computed-fields::identity',
          params: {
            sourceField: 'nutrients'
          }
        })
      ]);

    apple = factory.addResource('foods').withAttributes({
      title: 'Apple',
      weightInOunces: 16,
      nutrients: {
        fiber: 100
      }
    });

    env = await createDefaultEnvironment(`${__dirname}/../../../tests/sample-computed-fields`, factory.getModels());
  }

  async function teardown() {
    await destroyDefaultEnvironment(env);
  }

  describe('read-only', function() {
    before(setup);
    after(teardown);

    it("can depend on params", async function() {
      let model = await env.lookup('hub:searchers').get(env.session, 'master', 'foods', apple.id);
      expect(model.data).has.deep.property('attributes.weight-in-grams', 448);
    });

    it("can depend on another computed field", async function() {
      let model = await env.lookup('hub:searchers').get(env.session, 'master', 'foods', apple.id);
      expect(model.data).has.deep.property('attributes.weight-in-milligrams', 448000);
    });

    it("can depend on an attribute", async function() {
      let model = await env.lookup('hub:searchers').get(env.session, 'master', 'foods', apple.id);
      expect(model.data).has.deep.property('attributes.echo-title', 'Apple');
    });

    it("can depend on id", async function() {
      let model = await env.lookup('hub:searchers').get(env.session, 'master', 'foods', apple.id);
      expect(model.data).has.deep.property('attributes.echo-id');
      expect(model.data.attributes['echo-id']).to.equal(model.data.id);
    });

    // the "identity" computed field type is being used with both
    // strings and POJOs. That will cause elasticsearch to blow up
    // unless the dynamic type support is working.
    it("can determine its type dynamically", async function() {
      let model = await env.lookup('hub:searchers').get(env.session, 'master', 'foods', apple.id);
      expect(model.data).has.deep.property('attributes.echo-nutrients');
      expect(model.data.attributes['echo-nutrients']).to.deep.equal(model.data.attributes.nutrients);
    });

    it("can compute a relationship");

    it("can search a computed relationship's included attributes");
  });
});
