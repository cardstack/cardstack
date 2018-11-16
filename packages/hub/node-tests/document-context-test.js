/*
  Our npm package cannot depend on @cardstack/test-support
  because @cardstack/test-support depends on us. Instead, for our
  tests we have a separate "test-app" that holds our devDependencies.
*/

const Factory = require('../../../tests/pgsearch-test-app/node_modules/@cardstack/test-support/jsonapi-factory');

const DocumentContext = require('../indexing/document-context');
const { Registry, Container } = require('@cardstack/di');

const bootstrapSchema = require('../bootstrap-schema');


describe('DocumentContext', function() {
  let schemaLoader;

  before(async function() {
    let registry = new Registry();

    registry.register('config:project', {
      path: __dirname + '/../../../tests/pgsearch-test-app'
    }, { instantiate: false });

    schemaLoader = await new Container(registry).lookup('hub:schema-loader');
  });

  it('searchDoc does not contain unsearchable fields', async function() {
    let factory = new Factory();

    factory.addResource('content-types', 'puppies')
      .withRelated('fields', [
        factory.addResource('fields', 'name').withAttributes({
          fieldType: '@cardstack/core-types::string',
          searchable: false
        }),
        factory.addResource('fields', 'breed').withAttributes({
          fieldType: '@cardstack/core-types::string'
        }),
      ]);


    let schema = await schemaLoader.loadFrom(bootstrapSchema.concat(factory.getModels()));


    let searchDoc = await (new DocumentContext({ id: 'ringo', type: 'puppies', branch: 'master', schema, read: null,
      upstreamDoc: { data: { attributes: { name: 'Ringo', breed: 'yorkie' }} },
    })).searchDoc();

    expect(searchDoc).to.deep.equal({
      id: 'ringo',
      name: 'Ringo'
    });
  });
});
