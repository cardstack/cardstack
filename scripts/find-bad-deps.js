/* eslint-disable no-console */

let glob = require('glob');
let path = require('path');

let packages = glob.sync('./packages/*/package.json').map((p) => {
  return require(path.join(process.cwd(), p));
});

let ownPackages = new Map();
for (let pkg of packages) {
  ownPackages.set(pkg.name, pkg.version);
}

let hasMismatches = false;

for (let pkg of packages) {
  for (let field of ['dependencies', 'devDependencies', 'peerDependencies']) {
    if (pkg[field]) {
      for (let [k, v] of Object.entries(pkg[field])) {
        if (ownPackages.has(k) && ownPackages.get(k) !== v && v !== '*') {
          console.log(`mismatch in ${pkg.name} ${field}: ${k} is ${v}, should be ${ownPackages.get(k)}`);
          hasMismatches = true;
        }
      }
    }
  }
}

if (hasMismatches) {
  // eslint-disable-next-line no-process-exit
  process.exit(1);
}
