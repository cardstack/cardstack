const getPackageList = require('./list-linked-packages');
const { createInstalledVolumeFor, getCacheDir } = require('./initialize-module-dirs');
const symlinkPackages = require ('./symlink-packages');

const rootProjectPath = "/Users/aaron/dev/cardstack/packages/models";

let packages = getPackageList(rootProjectPath);
// let p = volumeForPackageAtIndex(packages, 0);
// for (let i = 1; i < packages.length; i++) {
//   p = p.then(() => volumeForPackageAtIndex(packages, i));
// }
// 
// p.then(function() {
  let p = symlinkPackages(packages);
//   return p;
// })
p.catch(function(code) {
  console.log('shit:', code);
});

function volumeForPackageAtIndex(packages, index) {
  let { path, volumeName } = packages[index];
  console.log('thing', index, packages[index]);
  return createInstalledVolumeFor(path, volumeName);
}
