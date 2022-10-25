const glob = require('glob');
const path = require('path');
// eslint-disable-next-line node/no-extraneous-require
const { readFileSync, outputFile } = require('fs-extra');

const globPattern = 'packages/cardpay-sdk/contracts/abi/latest/*.ts';

const pythonPackages = ['cardpay-reward-api', 'cardpay-reward-scheduler', 'reward-root-submitter'];

glob(globPattern, {}, (err, files) => {
  if (err) {
    throw new Error(err);
  }
  files.map((file) => {
    const typescriptModuleContents = readFileSync(file).toString();
    const contractAbi = typescriptModuleContents
      .replace('export default ', '')
      .replace('function noop() {};', '')
      .replace('noop();', '');
    const jsonAbi = JSON.stringify(eval(contractAbi), null, 2);
    let fileName = path.basename(file, '.ts') + '.json';
    pythonPackages.map((pythonPackage) => {
      outputFile(path.join('packages', pythonPackage, 'abis', fileName), jsonAbi);
    });
  });
});
