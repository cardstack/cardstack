const fs = require('fs');
const _ = require('lodash');
const {
  flatten,
  partition,
  uniq
} = _;

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
let packageLinks = enumeratePackageLinks(rootPackagePath);

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

let packageMapping = normalizeModules(packageLinks);
console.log(packageMapping);

function normalizeModules(packageLinks) {
  let allPaths = _(Array.from(packageLinks.values())).flatten().map(l => l.path).uniq().value();
  let modules = allPaths.map(resolveModule);
  let pathsForModuleName = _.groupBy(modules, 'name');

  let result = new Map();
  for (let name in pathsForModuleName) {
    let paths = pathsForModuleName[name];
    if (paths.length > 1) {
      throw new Error(`Multiple different locally linked modules were found for the name ${name}. CardStack hub only supports linking to a single version of a given module.`);
    }
    result.set(name, paths[0]);
  }
  return result;
}

function resolveModule(path) {
  return {
    name: require(path + '/package.json').name,
    path
  }
}


function enumeratePackageLinks(packagePath, packageLinks = new Map()) {
  let links = symlinksFromModulesFolder(packagePath + '/node_modules');

  packageLinks.set(packagePath, links);

  links.filter(l => !packageLinks.has(l.path))
    .forEach(l => enumeratePackageLinks(l.path, packageLinks));

  return packageLinks;
}

// [
//   { name: "@cardstack/hub2", path: "/Users/aaron/dev/cardstack/packages/hub" }
// ]
function symlinksFromModulesFolder(moduleDir) {
  let output = [];
  if (!fs.existsSync(moduleDir)) { return output; }
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
