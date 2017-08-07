const { basename } = require('path');
const { flatten, flattenDeep } = require('lodash');

const createService = require('./create-service');

module.exports = function createHubService(packages) {
  let mounts = flatten(packages.map(function(p) {
    return [
      '--mount', `type=bind,src=${p.path},dst=/packages/${p.name}`,
      '--mount', `type=volume,src=${p.volumeName},dst=/packages/${p.name}/node_modules`
    ];
  }));

  return createService([
      ...mounts,
      '--secret', 'cardstack-session-key',
      '--env', 'CARDSTACK_SESSIONS_KEY_FILE=/run/secrets/cardstack-session-key',
      '--env', 'ELASTICSEARCH=http://elasticsearch:9200',
      '--publish', '3000:3000',
      '--workdir', '/packages/@cardstack/models/',
      '--name', 'cardstack-hub',
      'cardstack/hub',
      'node', '/packages/@cardstack/hub/bin/server.js', '-d', '/packages/@cardstack/models/tests/dummy/cardstack/seeds/development'
  ], {stdio: 'inherit'});
}
