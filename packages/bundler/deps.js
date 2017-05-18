/*
   Identifies all server-side Hub dependencies. This includes

     - top-level `dependencies` (not `devDependencies`) of the project
       that are also cardstack-plugins.

     - `dependencies` of each of those, recursively (whether labeled
       as cardstack-plugin or not)
*/

const denodeify = require('denodeify');
const resolve = denodeify(require('resolve'));
const path = require('path');
const realpath = denodeify(require('fs').realpath);

async function deps(projectRoot) {
  let output = [];
  let seen = new Map();
  await gatherDeps(projectRoot, 0, seen, output);
  return output;
}

async function gatherDeps(dir, depth, seen, output) {
  dir = await realpath(dir);
  let pkg = require(dir + '/package.json');

  if (depth === 1 && !pkg['cardstack-plugin']) {
    return;
  }

  if (depth > 0) {
    output.push({ dir, name: pkg.name });
  }

  if (!pkg.dependencies) {
    return;
  }

  for (let packageName of Object.keys(pkg.dependencies)) {
    let childDir = await resolve(packageName + '/package.json', { basedir: dir });
    if (!seen.get(childDir)) {
      seen.set(childDir, true);
      await gatherDeps(path.dirname(childDir), depth + 1, seen, output);
    }
  }
}

module.exports = deps;
