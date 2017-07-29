const getPackageList = require('./list-linked-packages');
const { createInstalledVolumeFor, getCacheDir } = require('./initialize-module-dirs');
const symlinkPackages = require ('./symlink-packages');
const runElasticsearch = require('./create-elasticsearch-service');
const runHub = require('./create-hub-service');

const rootProjectPath = "/Users/aaron/dev/cardstack/packages/models";

let packages = getPackageList(rootProjectPath);

let p = Promise.resolve();

const DO_YARN_INSTALL = false;
const DO_LINKING      = false;

if (DO_YARN_INSTALL) {
  let p = volumeForPackageAtIndex(packages, 0);
  for (let i = 1; i < packages.length; i++) {
    p = p.then(() => volumeForPackageAtIndex(packages, i));
  }
}

if (DO_LINKING) {
  p = p.then(function() {
    return symlinkPackages(packages);
  });
}

p.then(function() {
  return runElasticsearch();
})
.then(function() {
  return runHub(packages);
})
.catch(function(code) {
  console.log('shit:', code);
});



function volumeForPackageAtIndex(packages, index) {
  let { path, volumeName } = packages[index];
  console.log('thing', index, packages[index]);
  return createInstalledVolumeFor(path, volumeName);
}
