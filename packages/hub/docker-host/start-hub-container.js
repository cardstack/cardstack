const crypto = require('crypto');
const {promisify} = require('util');
const child_process = require('child_process');
const {spawn} = child_process;
const execFile = promisify(child_process.execFile);
const timeout = promisify(setTimeout);

const Koa = require('koa');
const proxy = require('koa-proxy');
const nssocket = require('nssocket');
const StdBuffer = require('./stdbuffer');
const buildAppImage = require('./build-image');
const log = require('@cardstack/plugin-utils/logger')('hub/spawn-hub');
const {waitForExit} = require('../util/process');
const crawlPackages = require('./crawl-module-linkages');

const HUB_HEARTBEAT_INTERVAL = 1 * 1000;

module.exports = async function(project) {
  let packages = await crawlPackages(project.root);
  await waitForExit(buildAppImage(packages, project.pkg.name));

  let logs = await spawnHubContainer(project.root);

  let hub;
  try {
    hub = await socketToHub();
  } catch (e) {
    if (e.code === "ECONNREFUSED") {
      log.error("The hub container failed to start:");
      log.error(logs.err);
      throw new Error('Hub failed to start');
    } else {
      throw e;
    }
  }

  await new Promise(function(resolve) {
    hub.data('ready', resolve);
  });

  log.info('Ready message received from hub container');

  startHeartbeat(hub);

  let app = new Koa();
  app.use(proxy({
    host: 'http://localhost:3000'
  }));
  return app.callback();
};


async function socketToHub() {
  let hub = new nssocket.NsSocket();
  hub.connect(6785);

  return new Promise(function(resolve, reject) {
    log.trace("Attempting to connect to the hub's heartbeat port");

    async function onClose() {
      await timeout(50);
      resolve(socketToHub());
    }

    hub.on('close', onClose);
    hub.data('shake', function() {
      log.trace("Hub heartbeat connection established");
      hub.removeListener('close', onClose);
      resolve(hub);
    });
    hub.on('error', reject);
    hub.send('hand');
  });
}

// Spawns the hub container, and returns an object for getting its stdio
// We should, later, live bind code in as well.
async function spawnHubContainer(/*projectRoot*/) {
  let key = crypto.randomBytes(32).toString('base64');


  let {stdout} = await execFile('docker', [
    'run',
    '-d',
    '--rm',
    '--publish', '3000:3000',
    '--publish', '6785:6785',
    '--mount', 'type=bind,src=/var/run/docker.sock,dst=/var/run/docker.sock',
    '-e', `CARDSTACK_SESSIONS_KEY=${key}`,
    'cardstack-app'
  ]);

  let container_id = stdout.trim();

  return new StdBuffer(spawn('docker', ['logs', '-f', container_id]));
}

function startHeartbeat(hub) {
  let beat = function() {
    log.trace('Sending heartbeat to hub container');
    hub.send('heartbeat');
  };
  beat();
  setInterval(beat, HUB_HEARTBEAT_INTERVAL);
}
