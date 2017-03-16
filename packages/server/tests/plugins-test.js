const Plugins = require('@cardstack/server/plugins');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

describe('plugins', function() {
  let models;

  before(async function() {
    let factory = new JSONAPIFactory();
    factory.addResource('plugin-configs', '@cardstack/core-types');
    models = factory.getModels();
  });

  it('finds core type plugin', async function() {
    let plugins = await Plugins.load(models);
    expect(plugins.lookup('fields', '@cardstack/core-types::string')).has.property('valid');
  });

  it('finds core type plugin the second time', async function() {
    let plugins = await Plugins.load(models);
    plugins.lookup('fields', '@cardstack/core-types::string');
    expect(plugins.lookup('fields', '@cardstack/core-types::string')).has.property('valid');
  });

  it('finds core constraint plugin', async function() {
    let plugins = await Plugins.load(models);
    expect(plugins.lookup('constraints', '@cardstack/core-types::not-null')).has.property('valid');
  });
});
