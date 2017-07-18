#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');

try {
  fs.mkdirSync('node_modules/@cardstack');
} catch (err) {
  if (err.code !== 'EEXIST') {
    throw err;
  }
}

function ensureLink(linkTo, linkFrom) {
  execSync(`rm -rf ${linkFrom}`, { stdio: 'inherit' });
  fs.symlinkSync(linkTo, linkFrom);
}

ensureLink('/projects/hub', 'node_modules/@cardstack/hub');
execSync('yarn install', { stdio: 'inherit' });
process.chdir('/projects/hub');
execSync('yarn install',  { stdio: 'inherit' });
process.chdir('/projects/models');
execSync('node /projects/hub/bin/server.js -d ./tests/dummy/cardstack/seeds/development', { stdio: 'inherit' });
