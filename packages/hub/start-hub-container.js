const crypto = require('crypto');
const path = require('path');
const {promisify} = require('util');
const execFile = promisify(require('child_process').execFile);
const realpath = promisify(require('fs').realpath);

const Koa = require('koa');
const proxy = require('koa-proxy');
const nssocket = require('nssocket');
const path_is_inside = require('path-is-inside');
const resolve = promisify(require('resolve'));
const log = require('@cardstack/plugin-utils/logger')('hub/spawn-hub');

const HUB_HEARTBEAT_INTERVAL = 1 * 1000;

module.exports = async function(projectRoot) {
  let hubPath = await linkedHubPath(projectRoot);

  let hubBinding;
  if (hubPath) {
    log.info('Binding locally linked hub: '+hubPath);
    hubBinding = [
      '--mount', `type=bind,src=${hubPath},dst=/hub/app/node_modules/@cardstack/hub`
    ];
  } else {
    hubBinding = [];
  }

  let key = crypto.randomBytes(32).toString('base64');

  await execFile('docker', [
    'run',
    '-d',
    '--rm',
    '--publish', '3000:3000',
    '--publish', '6785:6785',
    '--mount', 'type=bind,src=/var/run/docker.sock,dst=/var/run/docker.sock',
    ...hubBinding,
    '-e', `CARDSTACK_SESSIONS_KEY=${key}`,
    'cardstack-app'
  ]);

  let hub = new nssocket.NsSocket();
  hub.connect(6785);

  await new Promise(function(resolve) {
    hub.data('ready', resolve);
  });

  log.info('Ready message received from hub container');

  let beat = function() {
    log.trace('Sending heartbeat to hub container');
    hub.send('heartbeat');
  };
  beat();
  setInterval(beat, HUB_HEARTBEAT_INTERVAL);

  let app = new Koa();
  app.use(proxy({
    host: 'http://localhost:3000'
  }));
  return app.callback();
};

async function linkedHubPath(projectRoot) {
  let hubPath = path.dirname(await resolve('@cardstack/hub/package.json', {basedir: projectRoot}));
  hubPath = await realpath(hubPath);

  // If hub is coming from outside our node_modules, we're linked to it,
  // so we should bind it in the container as well
  if (!path_is_inside(hubPath, projectRoot)) {
    return hubPath;
  } else {
    return false;
  }
}
