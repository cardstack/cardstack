const Plugins = require('@cardstack/hub/plugins');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

describe('plugins', function() {
  let models, plugins;

  before(async function() {
    let factory = new JSONAPIFactory();
    factory.addResource('plugin-configs')
      .withAttributes({
        module: '@cardstack/core-types',
        extraParam: 42
      });
    factory.addResource('plugin-configs')
      .withAttributes({
        module: '@cardstack/elasticsearch'
      });

    models = factory.getModels();
    plugins = await Plugins.load(models);
  });

  it('finds core type plugin', async function() {
    expect(plugins.lookup('fields', '@cardstack/core-types::string')).has.property('valid');
  });

  it('finds core type plugin the second time', async function() {
    plugins.lookup('fields', '@cardstack/core-types::string');
    expect(plugins.lookup('fields', '@cardstack/core-types::string')).has.property('valid');
  });

  it('finds core constraint plugin', async function() {
    expect(plugins.lookup('constraints', '@cardstack/core-types::not-null')).has.property('valid');
  });

  it('can lookup plugin config', async function() {
    expect(plugins.configFor('@cardstack/core-types')).property('extra-param', 42);
  });

  it('finds a searcher', async function() {
    expect(plugins.lookup('searchers', '@cardstack/elasticsearch')).is.a('function');
  });

  it('lists all of one type', async function() {
    let fields = plugins.listAll('fields');
    expect(fields).is.an('array');
    expect(fields).includes('@cardstack/core-types::string');
  });

});
