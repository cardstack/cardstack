const glob = require("glob");
const path = require('path');
const { readFileSync, outputFile } = require("fs-extra");
const prettier = require("prettier");
const kebabCase = require("lodash/kebabCase");

const targetDir = "abi/";

const globPattern = "packages/cardpay-sdk/contracts/abi/latest/*.ts";

const pythonPackages = ["cardpay-reward-api", "cardpay-reward-scheduler", "reward-root-submitter"]

glob(globPattern, {}, (err, files) => {
  if (err) {
    throw new Error(err);
  }
  files.map((file) => {
    let o;
    const typescriptModuleContents = readFileSync(file).toString();
    const contractAbi = typescriptModuleContents.replace('export default ', '').replace('function noop() {};', '').replace('noop();', '');
    const jsonAbi = JSON.stringify(eval(contractAbi), null, 2);
    let fileName = path.basename(file, '.ts') + '.json';
    pythonPackages.map((pythonPackage) => {
        outputFile(
            path.join("packages", pythonPackage, "abis", fileName), jsonAbi
        );
    });
  });
});
