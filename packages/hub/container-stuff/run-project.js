const getPackageList = require('./list-linked-packages');
const ensureVolumes = require('./ensure-volumes');
const yarnInstall = require('./initialize-module-dirs');
const { linkUpPackages } = require ('./yarn-link-packages');
const runElasticsearch = require('./create-elasticsearch-service');
const runHub = require('./create-hub-service');

const DO_YARN_INSTALL = false;
const DO_LINKING      = false;

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

    // await runElasticsearch();
    await runHub(packages);
    console.log("We're good :)");
  } catch(err) {
    console.error("Error starting hub & plugins", err);
  }
}
