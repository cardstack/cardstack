const JSONAPIFactory = require('../../../tests/sample-computed-fields/node_modules/@cardstack/test-support/jsonapi-factory');

const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('../../../tests/sample-computed-fields/node_modules/@cardstack/test-support/env');

describe('hub/computed-fields', function() {
  let env, apple, banana, chocolate, meatloaf, cream, sugar, icecream;

  async function setup () {
    let factory = new JSONAPIFactory();

    apple = factory.addResource('foods').withAttributes({
      title: 'Apple',
      color: 'red',
      weightInOunces: 16,
      nutrients: {
        fiber: 100
      }
    });

    banana = factory.addResource('foods').withAttributes({
      title: 'Banana',
      color: 'yellow',
      weightInOunces: 12,
      nutrients: {
        potassium: 40
      }
    }).withRelated('goesWellWith', [apple]);


    chocolate = factory.addResource('foods', 'chocolate').withAttributes({
      title: 'chocolate',
      color: 'brown',
      weightInOunces: 16,
    });

    cream = factory.addResource('foods', 'cream').withAttributes({
      title: 'Cream',
      color: 'white'
    });
    sugar = factory.addResource('foods', 'sugar').withAttributes({
      title: 'Sugar',
      color: 'white'
    });
    icecream = factory.addResource('foods').withAttributes({
      title: 'Icecream',
      color: 'white',
      'ingredients-label': 'cream, sugar, chocolate'
    });
    meatloaf = factory.addResource('foods').withAttributes({
      title: 'Meatloaf',
      color: 'brown',
      'ingredients-label': 'hamburger, egg, ketchup, salt, pepper'
    });
    factory.addResource('foods', 'hamburger').withAttributes({
      title: 'Hamburger',
      color: 'brown',
    });
    factory.addResource('foods', 'ketchup').withAttributes({
      title: 'Ketchup',
      color: 'red',
    });

    factory.addResource('content-types', 'foods')
      .withAttributes({
        defaultIncludes: ['ingredients']
      })
      .withRelated('fields', [
        factory.addResource('fields', 'title').withAttributes({
          fieldType: '@cardstack/core-types::string'
        }),
        factory.addResource('fields', 'color').withAttributes({
          fieldType: '@cardstack/core-types::string'
        }),
        factory.addResource('fields', 'ingredients-label').withAttributes({
          fieldType: '@cardstack/core-types::string'
        }),
        factory.addResource('fields', 'nutrients').withAttributes({
          fieldType: '@cardstack/core-types::any'
        }),
        factory.addResource('fields', 'goes-well-with').withAttributes({
          fieldType: '@cardstack/core-types::has-many'
        }),
        factory.addResource('fields', 'weight-in-ounces').withAttributes({
          fieldType: '@cardstack/core-types::integer'
        }),
        factory.addResource('computed-fields', 'ingredients').withAttributes({
          computedFieldType: 'sample-computed-fields::ingredients-from-label',
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
        }),
        factory.addResource('computed-fields', 'good-with-red').withAttributes({
          computedFieldType: 'sample-computed-fields::goes-well-with-color',
          params: {
            color: 'red'
          }
        }),
        factory.addResource('computed-fields', 'auto-chocolate').withAttributes({
          computedFieldType: 'sample-computed-fields::chocolate',
          params: {
            chocoId: chocolate.id
          }
        })
      ]);

    factory.addResource('content-types', 'only-computed')
      .withAttributes({
        defaultIncludes: ['auto-chocolate']
      })
      .withRelated('fields', [
        factory.getResource('computed-fields', 'auto-chocolate'),
        factory.addResource('computed-fields', 'always-42').withAttributes({
          computedFieldType: 'sample-computed-fields::forty-two'
        })
      ]);

    factory.addResource('only-computed', '1');

    factory.addResource('content-types', 'sample-searcher-models')
      .withRelated('fields', [
        factory.addResource('fields', 'height').withAttributes({
          fieldType: '@cardstack/core-types::integer'
        }),
        factory.addResource('computed-fields', 'double-height').withAttributes({
          computedFieldType: 'sample-computed-fields::multiply-by-constant',
          params: {
            sourceField: 'height',
            factor: 2
          }
        })
      ])
      .withRelated('data-source', factory.addResource('data-sources')
                   .withAttributes({ sourceType: 'sample-computed-fields' })
                  );

    env = await createDefaultEnvironment(`${__dirname}/../../../tests/sample-computed-fields`, factory.getModels());
  }

  async function teardown() {
    await destroyDefaultEnvironment(env);
  }

  describe('read-only', function() {
    before(setup);
    after(teardown);

    it("can depend on params", async function() {
      let model = await env.lookup('hub:searchers').getCard(env.session, 'master', 'foods', apple.id);
      expect(model.data).has.deep.property('attributes.weight-in-grams', 448);
    });

    it("can depend on another computed field", async function() {
      let model = await env.lookup('hub:searchers').getCard(env.session, 'master', 'foods', apple.id);
      expect(model.data).has.deep.property('attributes.weight-in-milligrams', 448000);
    });

    it("can depend on an attribute", async function() {
      let model = await env.lookup('hub:searchers').getCard(env.session, 'master', 'foods', apple.id);
      expect(model.data).has.deep.property('attributes.echo-title', 'Apple');
    });

    it("can depend on id", async function() {
      let model = await env.lookup('hub:searchers').getCard(env.session, 'master', 'foods', apple.id);
      expect(model.data).has.deep.property('attributes.echo-id');
      expect(model.data.attributes['echo-id']).to.equal(model.data.id);
    });

    // our "sample-computed-fields::identity" computed-field-type is
    // being used with both strings and POJOs. That will cause
    // elasticsearch to blow up unless the dynamic type support is
    // working.
    it("can determine its type dynamically", async function() {
      let model = await env.lookup('hub:searchers').getCard(env.session, 'master', 'foods', apple.id);
      expect(model.data).has.deep.property('attributes.echo-nutrients');
      expect(model.data.attributes['echo-nutrients']).to.deep.equal(model.data.attributes.nutrients);
    });

    it("can depend on fields on a related resource", async function() {
      let model = await env.lookup('hub:searchers').getCard(env.session, 'master', 'foods', apple.id);
      expect(model.data).has.deep.property('attributes.good-with-red', false);
      model = await env.lookup('hub:searchers').getCard(env.session, 'master', 'foods', banana.id);
      expect(model.data).has.deep.property('attributes.good-with-red', true);

    });

    it("can compute a belongs-to relationship", async function() {
      let model = await env.lookup('hub:searchers').getCard(env.session, 'master', 'foods', apple.id);
      expect(model.data).has.deep.property('relationships.auto-chocolate');
      expect(model.data.relationships['auto-chocolate']).deep.equals({ data: { type: 'foods', id: chocolate.id } });
    });

    it("can compute a has-many relationship", async function() {
      let model = await env.lookup('hub:searchers').getCard(env.session, 'master', 'foods', icecream.id);
      expect(model.data).has.deep.property('relationships.ingredients');
      expect(model.data.relationships['ingredients']).deep.equals({
        data: [
          { type: 'foods', id: cream.id },
          { type: 'foods', id: sugar.id },
          { type: 'foods', id: chocolate.id },
        ]
      });
    });

    it("can search a computed belongs-to relationship's included attributes", async function() {
      let response = await env.lookup('hub:searchers').search(env.session, 'master', { filter: { 'auto-chocolate.title': 'Chocolate' }});
      expect(response.data).has.length(1);
      expect(response.data[0]).has.property('id', '1');
      expect(response.data[0]).has.property('type', 'only-computed');
    });

    it("can search a computed has-many relationship's included attributes", async function() {
      let response = await env.lookup('hub:searchers').search(env.session, 'master', { filter: { 'ingredients.title': 'Ketchup' }});
      expect(response.data).has.length(1);
      expect(response.data[0]).has.property('id', meatloaf.id);
      expect(response.data[0]).has.property('type', meatloaf.type);
    });

    it("can compute an attribute even when there are no real attributes", async function() {
      let model = await env.lookup('hub:searchers').getCard(env.session, 'master', 'only-computed', '1');
      expect(model.data).has.deep.property('attributes.always-42', 42);
    });

    it("can compute a relationship even when there are no real relationships", async function() {
      let model = await env.lookup('hub:searchers').getCard(env.session, 'master', 'only-computed', '1');
      expect(model.data).has.deep.property('relationships.auto-chocolate.data.id', chocolate.id);
    });
  });

  describe('read-write', function() {
    beforeEach(setup);
    afterEach(teardown);

    it("includes computed field in create response", async function() {
      let model = await env.lookup('hub:writers').create('master', env.session, 'foods', {
        data: {
          type: 'foods',
          attributes: {
            title: 'Crumb',
            'weight-in-ounces': 1
          }
        }
      });
      expect(model.data).has.deep.property('attributes.weight-in-grams', 28);
    });

    it("includes computed field in update response", async function() {
      let model = await env.lookup('hub:searchers').getCard(env.session, 'master', 'foods', banana.id);
      model.data.attributes['weight-in-ounces'] = 1;
      let response = await env.lookup('hub:writers').update('master', env.session, 'foods', banana.id, model);
      expect(response.data).has.deep.property('attributes.weight-in-grams', 28);
    });

    it("updates computed field in response to a dependent model changing", async function() {
      let model = await env.lookup('hub:searchers').getCard(env.session, 'master', 'foods', apple.id);
      model.data.attributes['color'] = 'blue';
      await env.lookup('hub:writers').update('master', env.session, 'foods', apple.id, model);
      await env.lookup('hub:indexers').update({ forceRefresh: true });
      model = await env.lookup('hub:searchers').getCard(env.session, 'master', 'foods', banana.id);
      expect(model.data).has.deep.property('attributes.good-with-red', false);
    });

    it("adds computed fields to custom searcher's get response", async function() {
      let model = await env.lookup('hub:searchers').getCard(env.session, 'master', 'sample-searcher-models', '1');
      expect(model).has.deep.property('data.attributes.double-height', 2);
    });

    it("adds computed fields to custom searcher's search response", async function() {
      let response = await env.lookup('hub:searchers').search(env.session, 'master', { filter: { type: 'sample-searcher-models' } });
      expect(response.data).has.length(1);
      expect(response.data[0]).has.deep.property('attributes.double-height', 2);
    });

  });


});
