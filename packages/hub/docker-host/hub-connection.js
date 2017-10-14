const {promisify} = require('util');
const timeout = promisify(setTimeout);

const nssocket = require('nssocket');
const log = require('@cardstack/plugin-utils/logger')('hub/hub-connection');

const HUB_HEARTBEAT_INTERVAL = 1 * 1000;

class HubConnection {
  constructor(connection) {
    this.connection = connection;
    this.startHeartbeat();
    this.ready = this.awaitReady();
  }

  startHeartbeat(){
    let beat = () => {
      log.trace('Sending heartbeat to hub');
      this.connection.send('heartbeat');
    };
    beat();
    setInterval(beat, HUB_HEARTBEAT_INTERVAL);
  }

  awaitReady() {
    return new Promise((resolve, reject) => {
      this.connection.data('ready', function() {
        log.info('Ready message received from hub container');
        resolve();
      });
      this.connection.on('close', reject);
      this.connection.send('subscribeReady');
    });
  }

  shutdown() {
    this.connection.send('shutdown');
  }
}

async function connect() {
  try {
    let connection = await _connect();
    return new HubConnection(connection);
  } catch (e) {
    if (e.code === "ECONNREFUSED") {
      throw new Error('The hub is not accepting connections on port 6785');
    } else {
      throw e;
    }
  }
}

async function _connect() {
  let socket = new nssocket.NsSocket();
  socket.connect(6785);

  return new Promise(function(resolve, reject) {
    log.trace("Attempting to connect to the hub's heartbeat port");

    async function onClose() {
      await timeout(50);
      resolve(_connect());
    }

    socket.on('close', onClose);
    socket.data('shake', function() {
      log.trace("Hub heartbeat connection established");
      socket.removeListener('close', onClose);
      resolve(socket);
    });
    socket.on('error', reject);
    socket.send('hand');
  });
}

module.exports = {
  HubConnection,
  connect
};
