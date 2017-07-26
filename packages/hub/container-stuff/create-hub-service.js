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

  let docker_setup = [
      'service', 'create',
      ...mounts,
      '--secret', 'cardstack-session-key',
      '--env', 'CARDSTACK_SESSIONS_KEY_FILE=/run/secrets/cardstack-session-key',
      '--env', 'ELASTICSEARCH=http://elasticsearch:9200',
      '--name', 'cardstack-hub',
      '--network', 'thing',
      '--publish', '3000:3000',
      '--workdir', '/packages/@cardstack/models/'];

  let docker_command = [
      ...docker_setup,
      'cardstack/hub',
      'node', '/packages/@cardstack/hub/bin/server.js', '-d', '/packages/@cardstack/models/tests/dummy/cardstack/seeds/development'];

  let ln = spawn('docker', docker_command, { stdio: 'inherit' });

  // return new Promise(function(resolve, reject) {
  //   ln.on('error', reject);
  //   ln.on('exit', function(code) {
  //     let inspect_command = [
  //         'docker',
  //         ...docker_setup,
  //         '-it',
  //         'cardstack/hub',
  //         'sh'].join(' ');
  //     console.log('inspect linking results:', inspect_command);
  //     if (code === 0) {
  //       resolve();
  //     } else {
  //       reject(code);
  //     }
  //   });
  // });
}
