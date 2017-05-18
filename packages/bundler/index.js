const info = require('./info');
const archiver = require('./archiver');
const fs = require('fs');

async function makePackage(projectRoot, outDir) {
  let { prefix, copyRoots, main } = await info(projectRoot);
  await archiver(fs.createWriteStream(outDir + '/app.zip'), a => {
    for (let root of copyRoots) {
      a.directory(prefix + '/' + root, 'src/' + root);
    }
    a.append(`require("./src/${main}")`, { name: 'index.js' });
  });
}

module.exports = makePackage;

if (require.main === module) {
  let path = require('path');
  makePackage(path.resolve(process.argv[2]), '.');
}
