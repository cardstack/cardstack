const getPackageList = require('./list-linked-packages');
const ensureVolumes = require('./ensure-volumes');
const yarnInstall = require('./initialize-module-dirs');
const { linkUpPackages } = require ('./yarn-link-packages');
const createService = require('./create-service');
const runHub = require('./create-hub-service');
const createPluginServices = require('./create-plugin-services');

const DO_YARN_INSTALL    = true;
const DO_LINKING         = true;
const DO_CORE_SERVIES    = true;
const DO_PLUGIN_SERVICES = true;

runHubForProject('/Users/aaron/dev/cardstack/packages/models');

module.exports = runHubForProject;

async function runHubForProject(rootProjectPath) {
  let packages = getPackageList(rootProjectPath);

  try {
    await ensureVolumes(packages);

    if (DO_YARN_INSTALL) {
      for (let p of packages) {
        let { path, volumeName } = p;
        await yarnInstall(path, volumeName);
      }
    }

    if (DO_LINKING) {
      await linkUpPackages(packages);
    }

    if (DO_PLUGIN_SERVICES) {
      await createPluginServices();
    }

    if (DO_CORE_SERVIES) {
      await createService([
          '--name', 'elasticsearch',
          'cardstack/elasticsearch'
      ], {stdio: 'inherit'});

      await runHub(packages);
    }

    console.log("We're good :)");
  } catch(err) {
    console.error("Error starting hub & plugins", err);
  }
}
