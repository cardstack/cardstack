const crypto = require('crypto');
const {promisify} = require('util');
const child_process = require('child_process');
const execFile = promisify(child_process.execFile);


// Spawns the hub container, and returns an object for getting its stdio
// We should, later, live bind code in as well.
module.exports = async function spawnHubContainer(/*projectRoot*/) {
  let key = crypto.randomBytes(32).toString('base64');

  let {stdout} = await execFile('docker', [
    'run',
    '-d',
    '--publish', '3000:3000',
    '--publish', '6785:6785',
    '--mount', 'type=bind,src=/var/run/docker.sock,dst=/var/run/docker.sock',
    '-e', `CARDSTACK_SESSIONS_KEY=${key}`,
    'cardstack-app'
  ]);

  return stdout.trim();
}
