/* global __dirname, process, console */
/* eslint @typescript-eslint/explicit-module-boundary-types: "off" */

import { writeFileSync, readFileSync } from 'fs-extra';
import { join, resolve } from 'path';
import { sync as glob } from 'glob';

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

export function addFilePreamble(filePath, value) {
  let file = readFileSync(filePath, { encoding: 'utf8' });
  if (!file.startsWith(value)) {
    writeFileSync(
      filePath,
      `${value}
${file}`
    );
  }
}
