const fs = require('fs');
const { partition }  = require('lodash');

const rootPackagePath = "/Users/aaron/dev/cardstack/packages/models";

// how do we uniquely id linked packages?
// basically, path on the host filesystem.
// But, we don't really want to put that whole path in /packages.
// We could generate random ids?
// But it's nicer to have the folder be the packgage name.
// But then we could conflict.
// We could use package name, but fix conflicts specifically?
// What if our fix algo outputs something that conflicts?
// Or, we could just error if there's a conflict, and ask them to file an issue.

// Only support linking to package of same name?
//

// "/Users/aaron/dev/cardstack/packages/models": [
//   { name: "@cardstack/hub", path: "/Users/aaron/dev/cardstack/packages/hub" },
//   { name: "@cardstack/hub2", path: "/Users/aaron/dev/cardstack/packages/hub" }
// ]
let packageLinks = {};

enumeratePackageLinks(rootPackagePath);

console.log(JSON.stringify(packageLinks, null, 2));

// "@cardstack/models": {
//     name: "@cardstack/models",
//     path: "/Users/aaron/dev/cardstack/packages/models",
//     links: [
//       { name: "@cardstack/hub", package: "@cardstack/hub" },
//       { name: "@cardstack/hub2", package: "@cardstack/hub" }
//     ]
// }
// or, throw error:
// We don't support linking to multiple versions of the same package
//
// let packages = normalizeModules(packageLinks);


function enumeratePackageLinks(packagePath) {
  console.log('enumerating', packagePath);
  let links = symlinksFromModulesFolder(packagePath + '/node_modules');
  packageLinks[packagePath] = links;
  let alreadyEnumerated = Object.keys(packageLinks);
  links.filter(l => !alreadyEnumerated.includes(l.path))
    .forEach(l => enumeratePackageLinks(l.path));
}

function symlinksFromModulesFolder(moduleDir) {
  let output = [];
  for (let name of fs.readdirSync(moduleDir)) {
    let modulePath = moduleDir + '/' + name;

    if (/^@/.test(name)) {
      for (let scopedName of fs.readdirSync(modulePath)) {
        let stat = fs.lstatSync(modulePath + '/' + scopedName);
        if (stat.isSymbolicLink()) {
          output.push({
            name: name + '/' + scopedName,
            path: fs.realpathSync(modulePath + '/' + scopedName)
          });
        }
      }
    } else {
      let stat = fs.lstatSync(modulePath);
      if (stat.isSymbolicLink()) {
        output.push({ name, path: fs.realpathSync(modulePath) });
      }
    }
  }
  return output;
}
