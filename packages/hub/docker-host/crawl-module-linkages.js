const {promisify} = require('util');
const realpath = promisify(require('fs').realpath);
const path = require('path');
const resolve = promisify(require('resolve'));
const path_is_inside = require('path-is-inside');
const _ = require('lodash');
const {
  flatten,
  partition,
  uniq
} = _;


module.exports = getPackageList;

// [{
//     name: "basic-cardstack",
//     path: "/Users/aaron/dev/basic-cardstack",
//     volumeName: "basic-cardstack-node_modules,
//     links: [ "@cardstack/hub", "@cardstack/models" ]
// }]
async function getPackageList(rootPackagePath) {

  // Map {
  //   "/Users/aaron/dev/basic-cardstack" => [
  //     {
  //       name: "@cardstack/hub",
  //       path: "/Users/aaron/dev/cardstack/packages/hub",
  //       from: "/Users/dev/basic-cardstack"
  //     }
  //   ]
  // }
  let moduleLinkings = await recursivelyFindLinkedModules(rootPackagePath);


  // Map {
  //   "/Users/aaron/dev/cardstack/packages/hub" => "@cardstack/hub"
  // }
  // or, throw an error:
  //     Multiple different linked versions of "somedep" were found:
  //       "/Users/dev/cardstack/packages/hub" links to "/Users/aaron/work/somedep"
  //       "/Users/dev/cardstack/packages/di" links to "/Users/aaron/hacking/somedep"
  //     Cardstack hub only supports linking to a single version of a given module
  let packageMap = allPathMappings(moduleLinkings);

  let packageName = getPackageName(rootPackagePath);
  packageMap.set(rootPackagePath, packageName);

  // Final result:
  // [{
  //     name: "@cardstack/models",
  //     path: "/Users/aaron/dev/cardstack/packages/models",
  //     volumeName: "cardstack-models-node_modules",
  //     links: [ "@cardstack/hub", "@cardstack/models" ]
  // }]
  return stitchPackages(moduleLinkings, packageMap);
}

function getPackageName(packagePath) {
  return require(path.join(packagePath, 'package.json')).name;
}

function stitchPackages(modules, pathResolver) {
  let result = [];
  for (let [path, links] of modules) {
    let name = pathResolver.get(path);
    result.push({
      name,
      path,
      volumeName: name.replace('@', '').replace('/', '-') + "-node_modules",
      links: links.map(x=>x.name)
    });
  }
  return result;
}

function allPathMappings(moduleLinkings) {
  let allLinks = Array.from(moduleLinkings.values()).reduce((a,b)=>a.concat(b), []);

  let result = new Map();

  let linksByModule = _.groupBy(allLinks, 'name');

  for (let moduleName in linksByModule) {
    let links = linksByModule[moduleName];
    let paths = links.map(x=>x.path)
    if (_.uniq(paths).length > 1) {
      let linksMsg = links.map(l => {
        return `"${l.from}" links to "${l.path}"`;
      }).join('\n')
      let msg =
`Multiple different linked versions of "${moduleName}" were found:
${linksMsg}
Cardstack hub only supports linking to a single version of a given module`;
      throw new Error(msg);
    } else {
      result.set(paths[0], moduleName);
    }
  }

  return result;
}

async function recursivelyFindLinkedModules(packageDir, packageLinks = new Map()) {
  if (packageLinks.has(packageDir)) {
    return;
  } else {
    packageLinks.set(packageDir, null);
  }
  let deps = allDeps(packageDir);

  let depResolutions = await Promise.all(deps.map(async function(depName) {
    // resolving the package.json instead of the module name lets us find the root
    // directory. Otherwise, we get different results depending on package.json's "main" key
    let depPackagePath = await resolve(depName + '/package.json', {basedir: packageDir});
    depPackagePath = await realpath(depPackagePath);
    let depDir = depPackagePath.replace(/\/package\.json$/, '')
    return {
      name: depName,
      path: depDir,
      from: packageDir
    };
  }));

  let links = depResolutions.filter(function(dep) {
    return !path_is_inside(dep.path, packageDir);
  });

  packageLinks.set(packageDir, links);

  // ah this is async so we need some sort of work queue of directories to do.
  let newPackages = links.filter(l => !packageLinks.has(l.path));

  await Promise.all(newPackages.map(l => recursivelyFindLinkedModules(l.path, packageLinks)));

  return packageLinks;
}

function allDeps(packageDir) {
  let packageJSON = require(packageDir + '/package.json');
  let deps = packageJSON.dependencies || {};
  let devDeps = packageJSON.devDependencies || {};
  return Object.keys(deps).concat(Object.keys(devDeps));
}

