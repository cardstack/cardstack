const { basename } = require('path');
const { spawn } = require('child_process');
const { flatten, flattenDeep } = require('lodash');

module.exports = createService;

function createService(packages) {
  let mounts = flatten(packages.map(function(p) {
    return [
      '--mount', `type=bind,src=${p.path},dst=/packages/${p.name}`,
      '--mount', `type=volume,src=${p.volumeName},dst=/packages/${p.name}/node_modules`
    ];
  }));

  let hub = spawn('docker', [
      'service', 'create',
      ...mounts,
      '--detach=false',
      '--secret', 'cardstack-session-key',
      '--env', 'CARDSTACK_SESSIONS_KEY_FILE=/run/secrets/cardstack-session-key',
      '--env', 'ELASTICSEARCH=http://elasticsearch:9200',
      '--name', 'cardstack-hub',
      '--label', 'io.cardstack.hub',
      '--network', 'thing',
      '--publish', '3000:3000',
      '--workdir', '/packages/@cardstack/models/',
      'cardstack/hub',
      'node', '/packages/@cardstack/hub/bin/server.js', '-d', '/packages/@cardstack/models/tests/dummy/cardstack/seeds/development'
  ], { stdio: 'inherit' });

  return new Promise(function(resolve, reject) {
    hub.on('error', reject);
    hub.on('exit', function(code) {
      if (code === 0) {
        resolve();
      } else {
        reject(code);
      }
    });
  });
}
