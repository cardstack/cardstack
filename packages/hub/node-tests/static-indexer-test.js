const JSONAPIFactory = require('../../../tests/stub-static-models/node_modules/@cardstack/test-support/jsonapi-factory');
const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('../../../tests/stub-static-models/node_modules/@cardstack/test-support/env');
const project = __dirname + '/../../../tests/stub-static-models';

describe('static indexers', function() {
  describe('schemas indexer', function () {
    it('can rely on schema from schema feature', async function () {
      let factory = new JSONAPIFactory();
      factory.addResource('data-sources').withAttributes({
        'source-type': 'data-source-with-static',
        params: {
          otherThing2Title: 'chocolate cake'
        }
      });
      factory.addResource('my-things', '1');
      let env = await createDefaultEnvironment(project, factory.getModels());

      await destroyDefaultEnvironment(env);
    });

    it('does not allow schema data source to contain non-schema models', async function () {
      let factory = new JSONAPIFactory();
      factory.addResource('data-sources').withAttributes({
        'source-type': 'data-source-with-non-schema-in-schemas',
      });
      factory.addResource('my-things', '1');

      let error;
      try {
        await createDefaultEnvironment(project, factory.getModels());
        // dont destroy test env since it was never created in the first place
      } catch (e) {
        error = e;
      }
      expect(error.message).to.match(/defines schema that includes non-schema models. Non-schema models are not allowed in schemas. Found non-schema models: \["other-things\/1"\]/);
    });
  });

  describe('static-models indexer', function () {
    it('can rely on static content', async function () {
      let factory = new JSONAPIFactory();
      factory.addResource('data-sources').withAttributes({
        'source-type': 'data-source-with-static',
        params: {
          otherThing2Title: 'chocolate cake'
        }
      });
      let env = await createDefaultEnvironment(project, factory.getModels());
      await env.lookup('hub:searchers').get(env.session, 'local-hub', 'other-things', '2');

      await destroyDefaultEnvironment(env);
    });

    it('has access to data source params', async function () {
      let factory = new JSONAPIFactory();
      factory.addResource('data-sources').withAttributes({
        'source-type': 'data-source-with-static',
        params: {
          otherThing2Title: 'chocolate cake'
        }
      });
      let env = await createDefaultEnvironment(project, factory.getModels());
      let thing = await env.lookup('hub:searchers').get(env.session, 'local-hub', 'other-things', '2');
      expect(thing).has.deep.property('data.attributes.title-of-thing', 'chocolate cake');

      await destroyDefaultEnvironment(env);
    });

    it('does not allow static-model data source to contain schema', async function () {
      let factory = new JSONAPIFactory();
      factory.addResource('data-sources').withAttributes({
        'source-type': 'data-source-with-schema-in-static-models',
      });
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
});
