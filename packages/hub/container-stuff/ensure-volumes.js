const { basename } = require('path');
const { spawn } = require('child_process');
const { flatten, flattenDeep } = require('lodash');

module.exports = ensureVolumes;

// If a volume with the given name already exists, this does nothing.
// That seems fine for now! For rock-solid idempotence, we might want
// to check if they exist first, with the proper labels.

function ensureVolumes(packages) {
  let volumes = packages.map(p=>p.volumeName);
  volumes = [
    'cardstack-yarn-cache',
    'cardstack-yarn-link-dir',
    ...volumes
  ];

  let args = [
    'volume',
    'create',
    '--label', 'io.cardstack.hub',
  ];

  let creates = volumes.map(function(name) {
    return spawn('docker', args.concat(name));
  }).map(function(c) {
    return new Promise(function(resolve, reject) {
      c.on('error', reject);
      c.on('exit', function(code) {
        if (code === 0) {
          resolve();
        } else {
          reject(code);
        }
      });
    });
  });

  return Promise.all(creates);
}
