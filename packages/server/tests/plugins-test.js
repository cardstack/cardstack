const Plugins = require('@cardstack/server/plugins');

describe('plugins', function() {
  it('finds core type plugins', async function() {
    let plugins = await Plugins.load();
    expect(plugins.fieldType('string')).has.property('valid');
  });
  it('works the second time', async function() {
    let plugins = await Plugins.load();
    plugins.fieldType('string');
    expect(plugins.fieldType('string')).has.property('valid');
  });
});
