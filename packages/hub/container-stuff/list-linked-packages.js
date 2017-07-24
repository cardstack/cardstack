const fs = require('fs');
const _ = require('lodash');
const {
  flatten,
  partition,
  uniq
} = _;

module.exports = getPackageList;

function getPackageList(rootPackagePath) {

  // Map {
  //   "/Users/aaron/dev/cardstack/packages/models" => [
  //     { name: "@cardstack/hub", path: "/Users/aaron/dev/cardstack/packages/hub" },
  //     { name: "@cardstack/hub2", path: "/Users/aaron/dev/cardstack/packages/hub" }
  //   ]
  // }
  let moduleLinkings = recursivelyFindLinkedModules(rootPackagePath);

  // [
  //   "/Users/aaron/dev/cardstack/packages/models",
  //   "/Users/aaron/dev/cardstack/packages/hub"
  // ]
  let linkedPaths = _(Array.from(moduleLinkings.values())).flatten().map(l => l.path).uniq().value();

  // [
  //   { name: "@cardstack/models", path: "/Users/aaron/dev/cardstack/packages/models" },
  //   { name: "@cardstack/hub", path: "/Users/aaron/dev/cardstack/packages/hub" }
  // ]
  // or, throw error:
  // Multiple locally linked modules were found with the same name: "@cardstack/di".
  // CardStack hub only supports linking to a single version of a given module.
  let packageResolutions = resolvePackages(linkedPaths);

  // [{
  //     name: "@cardstack/models",
  //     path: "/Users/aaron/dev/cardstack/packages/models",
  //     links: [
  //       { name: "@cardstack/hub", package: "@cardstack/hub" },
  //       { name: "@cardstack/hub2", package: "@cardstack/hub" }
  //     ]
  // }]
  return stitchPackages(moduleLinkings, packageResolutions);
}

// let packages = getPackageList("/Users/aaron/dev/cardstack/packages/models");
// console.log(JSON.stringify(packages, null, 2));

function stitchPackages(modules, pathResolver) {
  let result = [];
  for (let [path, links] of modules) {
    result.push({
      path,
      name: pathResolver.get(path),
      links: links.map(({name, path}) => { return { name, package: pathResolver.get(path) }; })
    });
  }
  return result;
}


function resolvePackages(paths) {
  let modules = paths.map(resolveModule);
  let pathsForModuleName = _.groupBy(modules, 'name');

  let result = new Map();
  for (let name in pathsForModuleName) {
    let paths = pathsForModuleName[name];
    if (paths.length > 1) {
      throw new Error(`Multiple different locally linked modules were found for the name ${name}. CardStack hub only supports linking to a single version of a given module.`);
    }
    result.set(paths[0].path, paths[0].name);
  }
  return result;
}

function resolveModule(path) {
  return {
    name: require(path + '/package.json').name,
    path
  }
}


function recursivelyFindLinkedModules(packagePath, packageLinks = new Map()) {
  let links = symlinksFromModulesFolder(packagePath + '/node_modules');

  packageLinks.set(packagePath, links);

  links.filter(l => !packageLinks.has(l.path))
    .forEach(l => recursivelyFindLinkedModules(l.path, packageLinks));

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
