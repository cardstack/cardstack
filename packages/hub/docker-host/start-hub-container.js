const crypto = require('crypto');
const {promisify} = require('util');
const child_process = require('child_process');
const {spawn} = child_process;
const execFile = promisify(child_process.execFile);

const Koa = require('koa');
const proxy = require('koa-proxy');
const StdBuffer = require('./stdbuffer');
const buildAppImage = require('./build-image');
const log = require('@cardstack/plugin-utils/logger')('hub/spawn-hub');
const {waitForExit} = require('../util/process');
const crawlPackages = require('./crawl-module-linkages');
const {connect} = require('./hub-connection');

const HUB_HEARTBEAT_INTERVAL = 1 * 1000;

module.exports = async function() {
  let container_id = await spawnHubContainer();

  console.log('container id', container_id);
  let logs = new StdBuffer(spawn('docker', ['logs', '-f', container_id]));

  try {
    await connect();
  } catch (e) {
    if (e.code === "ECONNREFUSED") {
      log.error("The hub container failed to start:");
      log.error(logs.err);
      throw new Error('Hub failed to start');
    } else {
      throw e;
    }
  }

  return container_id;
};


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

  return stdout.trim();
}
