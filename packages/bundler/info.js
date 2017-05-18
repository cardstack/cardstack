const findDeps = require('./deps');

async function info(projectRoot) {
  let deps = await findDeps(projectRoot);
  let { root, names } = toTree(deps);
  let { relativeRoot, prefix } = stripSharedPrefix(root, names);
  let copyRoots = findCopyRoots(relativeRoot, names);
  let main = deps.find(d => d.name === '@cardstack/hub');
  return { prefix, copyRoots, main: main.dir.replace(prefix + '/', '') + '/bin/server.js' };
}

function stripSharedPrefix(root, names) {
  let keys;
  let prefixParts = [];
  while (!names.get(root) && (keys = Object.keys(root)) && keys.length === 1) {
    root = root[keys[0]];
    prefixParts.push(keys[0]);
  }
  return { relativeRoot: root, prefix: prefixParts.join('/') };
}

function toTree(deps) {
  let root = Object.create(null);
  let names = new Map();
  for (let entry of deps) {
    let pointer = root;
    for (let part of entry.dir.split("/")) {
      if (!pointer[part]) {
        pointer[part] = Object.create(null);
      }
      pointer = pointer[part];
    }
    names.set(pointer, entry.name);
  }
  return { root, names };
}

function findCopyRoots(relativeRoot, names) {
  if (names.get(relativeRoot)) {
    return [''];
  }

  let output = [];
  for (let segment of Object.keys(relativeRoot)) {
    output = output.concat(findCopyRoots(relativeRoot[segment], names).map(path => segment + '/' + path));
  }
  return output;
}

module.exports = info;
