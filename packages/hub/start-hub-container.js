const {spawn} = require('child_process');
const crypto = require('crypto');
const Koa = require('koa');
const proxy = require('koa-proxy');
const nssocket = require('nssocket');

const log = require('@cardstack/plugin-utils/logger')('hub/spawn-hub');

const HUB_HEARTBEAT_INTERVAL = 1 * 1000;

module.exports = async function() {
  let key = crypto.randomBytes(32).toString('base64');

  let proc = spawn('docker', [
    'run',
    '-d',
    '--rm',
    '--publish', '3000:3000',
    '--publish', '6785:6785',
    '--mount', 'type=bind,src=/var/run/docker.sock,dst=/var/run/docker.sock',
    '--mount', 'type=bind,src=/Users/aaron/dev/cardstack/packages/hub,dst=/hub/app/node_modules/@cardstack/hub',
    '-e', 'ELASTICSEARCH=http://localhost:9200',
    '-e', `CARDSTACK_SESSIONS_KEY=${key}`,
    'cardstack-app'
  ], {
    stdio: 'inherit'
  });

  await new Promise(function(resolve) {
    proc.on('exit', resolve);
  });

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
