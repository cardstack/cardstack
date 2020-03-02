/* eslint-env node */

const glob = require('glob');
const { join, resolve } = require('path');
const { emptyDirSync, copySync } = require('fs-extra');
const { execSync } = require('child_process');
const root = resolve(join(__dirname, '..'));
const specialBranches = ['master', 'production'];
const context = join(root, 'deploy/context');
const depLayerFiles = ['package.json'];
const codeLayerFiles = ['cardstack', 'config', 'app', 'public', 'ember-cli-build.js', '.ember-cli.js'];

emptyDirSync(context);
copySync(join(root, 'deploy/Dockerfile'), join(context, 'Dockerfile'));

// dep-layer contains things that will trigger a new yarn install (expensive)
depLayerFiles.forEach(serverFile => {
  glob.sync(join(root, serverFile)).forEach(filename => {
    copySync(filename, join(context, 'dep-layer', filename.replace(root, '')));
  });
});

copySync(join(root, 'package.json'), join(context, 'dep-layer/package.json'));
copySync(join(`${root}/../..`, 'yarn.lock'), join(context, 'dep-layer/yarn.lock'));

// code-layer contains everything else, which is much cheaper to rebuild (no yarn install)
copySync(join(root, 'cardstack'), join(context, 'code-layer/cardstack'));
codeLayerFiles.forEach(serverFile => {
  glob.sync(join(root, serverFile)).forEach(filename => {
    copySync(filename, join(context, 'code-layer', filename.replace(root, '')));
  });
});

let dockerImageLabel = specialBranches.includes(process.env.GITHUB_BRANCH)
  ? process.env.GITHUB_BRANCH
  : process.env.GITHUB_BUILD_ID || 'latest';

try {
  process.stdout.write(`Retrieving docker build from ${process.env.ECR_ENDPOINT}:${dockerImageLabel} ...`);
  execSync(`docker pull ${process.env.ECR_ENDPOINT}:${dockerImageLabel}`);
} catch (err) {
  if (!/manifest.*not found/.test(err.message)) {
    throw err;
  }
  process.stdout.write(`No build cache found for cardhost:${dockerImageLabel}, building from scratch.`);
}
execSync(
  `docker build -f ${join(context, 'Dockerfile')} --cache-from ${
    process.env.ECR_ENDPOINT
  }:${dockerImageLabel} -t cardhost ${context}`,
  { stdio: 'inherit' }
);
