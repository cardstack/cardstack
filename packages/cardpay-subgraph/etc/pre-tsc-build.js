/* global __dirname, process, console, require, exports */
/* eslint @typescript-eslint/explicit-module-boundary-types: "off", @typescript-eslint/no-var-requires: "off" */

const { writeFileSync, readFileSync } = require('fs-extra');
const { join, resolve } = require('path');
const { sync: glob } = require('glob');

const generatedDir = resolve(join(__dirname, '..', 'generated'));
const graphProtocolNodeModules = resolve(join(__dirname, '..', 'node_modules', '@graphprotocol'));
const protofireNodeModules = resolve(join(__dirname, '..', 'node_modules', '@protofire'));
let generatedFiles = glob(`${generatedDir}/**/*.ts`)
  .concat(glob(`${graphProtocolNodeModules}/**/*.ts`))
  .concat(glob(`${protofireNodeModules}/**/*.ts`));
const noCheck = `// @ts-nocheck`;

for (let filePath of generatedFiles) {
  addFilePreamble(filePath, noCheck);
}

exports.addFilePreamble = addFilePreamble;
function addFilePreamble(filePath, value) {
  let file = readFileSync(filePath, { encoding: 'utf8' });
  if (!file.startsWith(value)) {
    writeFileSync(
      filePath,
      `${value}
${file}`
    );
  }
}
