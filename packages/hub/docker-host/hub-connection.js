const {promisify} = require('util');
const timeout = promisify(setTimeout);

const nssocket = require('nssocket');
const log = require('@cardstack/plugin-utils/logger')('hub/hub-connection');

const HUB_HEARTBEAT_INTERVAL = 1 * 1000;

class HubConnection {
  constructor(connection) {
    this.connection = connection;
    this.ready = new Promise(function(resolve, reject) {
      this.connection.data('ready', function() {
        log.info('Ready message received from hub container');
        resolve();
      });
      this.connection.on('close', reject);
    });
  }

  startHeartbeat(){
    let beat = function() {
      log.trace('Sending heartbeat to hub');
      this.connection.send('heartbeat');
    }
    beat();
    setInterval(beat, HUB_HEARTBEAT_INTERVAL);
  }
}

async function connect() {
  let connection = new nssocket.NsSocket();
  connection.connect(6785);

  return new Promise(function(resolve, reject) {
    log.trace("Attempting to connect to the hub's heartbeat port");

    async function onClose() {
      await timeout(50);
      resolve(connect());
    }

    connection.on('close', onClose);
    connection.data('shake', function() {
      log.trace("Hub heartbeat connection established");
      connection.removeListener('close', onClose);
      resolve(connection);
    });
    connection.on('error', reject);
    connection.send('hand');
  });
}

module.exports = {
  HubConnection,
  connect
}
