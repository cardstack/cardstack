const fs = require('fs');
const path = require('path');
const { Registry, Container } = require('@cardstack/di');
const createService = require('./create-service');

module.exports = async function createPluginServices() {
  let registry = new Registry();

  registry.register('config:project', {
    path: '/Users/aaron/dev/cardstack/packages/models',
    allowDevDependencies: true
  });

  let container = new Container(registry);

  let loader = container.lookup('hub:plugin-loader');

  let pluginConfigs = loadSeedModels('/Users/aaron/dev/cardstack/packages/models/tests/dummy/cardstack/seeds/development').filter(model => model.type === 'plugin-configs');

  let plugins = await loader.activePlugins(pluginConfigs);

  let services = plugins.listAll('docker-services').map(s => plugins.lookupFeature('docker-services', s));

  return Promise.all(services.map(function(service_config) {
    return createService([
      '--name', service_config.name,
      service_config.image
    ], {stdio: 'inherit'});
  }));

}


function loadSeedModels(dir) {
  try {
    return fs.readdirSync(dir).map(filename => require(path.join(dir, filename))).reduce((a,b) => a.concat(b), []);
  } catch (err) {
    process.stderr.write(`Error loading seed directory (${dir}): ${err}\n`);
    process.exit(-1);
  }
}
