const JSONAPIFactory = require('../../../tests/stub-static-models/node_modules/@cardstack/test-support/jsonapi-factory');
const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('../../../tests/stub-static-models/node_modules/@cardstack/test-support/env');
const project = __dirname + '/../../../tests/stub-static-models';

describe('static-models indexers', function () {
  // TODO this test eventually goes away after schema defined in scmea feature is able to be used
  describe('valid schema', function () {
    let env, factory;

    beforeEach(async function() {
      factory = new JSONAPIFactory();
      factory.addResource('data-sources').withAttributes({
        'source-type': 'data-source-with-static',
        params: {
          otherThing2Title: 'chocolate cake'
        }
      });
    });

    afterEach(async function() {
      await destroyDefaultEnvironment(env);
    });

    it('can rely on schema from static content', async function () {
      factory.addResource('my-things', '1');
      env = await createDefaultEnvironment(project, factory.getModels());
    });

    it('can rely on static content', async function () {
      factory.addResource('content-types', 'other-things')
        .withRelated('fields', [
          factory.addResource('fields', 'title-of-thing')
            .withAttributes({
              'field-type': '@cardstack/core-types::string'
            })
        ]);
      env = await createDefaultEnvironment(project, factory.getModels());
      await env.lookup('hub:searchers').get(env.session, 'local-hub', 'other-things', '2');
    });

    it('has access to data source params', async function () {
      factory.addResource('content-types', 'other-things')
        .withRelated('fields', [
          factory.addResource('fields', 'title-of-thing')
            .withAttributes({
              'field-type': '@cardstack/core-types::string'
            })
        ]);
      env = await createDefaultEnvironment(project, factory.getModels());
      let thing = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'other-things', '2');
      expect(thing).has.deep.property('data.attributes.title-of-thing', 'chocolate cake');
    });
  });

  // TODO: We need to grandfather in the current static-model ability to specify schema if we want to limit this PR to
  // reasoning about being able to specify the new card schema only--otherwise we'll need to also implement the new
  // card indexing at the same time as well. The next step here is to remove this grandfathering so that everything uses
  // the new schema feature and as a result everything is forced to use the new card boundaries.
  it.skip('does not allow static-model data source to contain schema', async function () {
    let factory = new JSONAPIFactory();
    factory.addResource('data-sources').withAttributes({
      'source-type': 'data-source-with-schema-in-static-models',
    });
    factory.addResource('content-types', 'my-things');
    factory.addResource('my-things', '1');

    let error;
    try {
      await createDefaultEnvironment(project, factory.getModels());
      // dont destroy test env since it was never created in the first place
    } catch (e) {
      error = e;
    }
    expect(error.message).to.match(/defines static-models that includes schema. Schema is not allowed in static-models. Found schema models: \["content-types\/bananas"\]/);
  });
});
