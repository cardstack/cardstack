const getPackageList = require('./list-linked-packages');
const { createInstalledVolumeFor, getCacheDir } = require('./initialize-module-dirs');
const linkPackages = require ('./symlink-packages');
const runElasticsearch = require('./create-elasticsearch-service');
const runHub = require('./create-hub-service');

const DO_YARN_INSTALL = true;
const DO_LINKING      = true;

module.exports = function runHubForProject(rootProjectPath) {
  let packages = getPackageList(rootProjectPath);

  let p = Promise.resolve();


  if (DO_YARN_INSTALL) {
    let p = volumeForPackageAtIndex(packages, 0);
    for (let i = 1; i < packages.length; i++) {
      p = p.then(() => volumeForPackageAtIndex(packages, i));
    }
  }

  if (DO_LINKING) {
    p = p.then(function() {
      return linkPackages(packages);
    });
  }

  return p.then(function() {
    return runElasticsearch();
  })
  .then(function() {
    return runHub(packages);
  })
  .catch(function(code) {
    console.error("Error starting up the hub & plugins :(");
  });
}


function volumeForPackageAtIndex(packages, index) {
  let { path, volumeName } = packages[index];
  return createInstalledVolumeFor(path, volumeName);
}
