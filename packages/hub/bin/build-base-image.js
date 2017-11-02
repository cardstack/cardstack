const { waitForExit } = require('../util/process');
const { buildBaseImage } = require('../docker-host/build-image');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const realpath = promisify(fs.realpath);
const readdir = promisify(fs.readdir);

async function findBasePackages() {
  let packagesDir = path.join(__dirname, '..', '..');
  let output = [];
  for (let filename of await readdir(packagesDir)) {
    try {
      let name = require(path.join(packagesDir, filename, 'package.json')).name;
      let dir = await realpath(path.join(packagesDir, filename));
      output.push({ name, path: dir });
    } catch(err) {
      if (err.code !== 'MODULE_NOT_FOUND' ) {
        throw err;
      }
    }
  }
  return output;
}

async function run() {
  let packages = await findBasePackages();
  let proc = buildBaseImage(packages);
  process.stdout.write("Building base docker image...\n");
  proc.stdout.pipe(process.stdout);
  proc.stderr.pipe(process.stderr);
  await waitForExit(proc);
}

run();
