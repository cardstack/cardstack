const nssocket = require('nssocket');
const _ = require('lodash');

const log = require('@cardstack/plugin-utils/logger')('ember-connection');

const HUB_HEARTBEAT_TIMEOUT = 7.5 * 1000; // longer than the heartbeat interval of 1 second

module.exports = class EmberConnector {
  constructor({orchestrator, heartbeat}) {
    this.orchestrator = orchestrator;

    if (heartbeat) {
      this.stopLater = _.debounce(this._stop.bind(this), HUB_HEARTBEAT_TIMEOUT);
    }

    let that = this;

    this._server = nssocket.createServer(async function(socket) {
      log.info('Connection established from ember-cli');

      // Docker does some weird stuff for containers with published ports
      // before they start actually listening on the port. Long story short,
      // we need a handshake when we first establish a connection.
      socket.data('hand', function() {
        socket.send('shake');
      });

      // Ember-cli may shut us down manually.
      socket.data('shutdown', function() {
        console.log('Received shutdown message from ember-cli');
        orchestrator.stop()
      });

      if (heartbeat) {
        // Or, if it crashes or is killed it will stop sending the heartbeat
        // and we can clean ourselves up.
        socket.data('heartbeat', function(){
          log.trace('Received a heartbeat from ember-cli');
          that.stopLater();
        });
      }

      socket.data('subscribeReady', async function() {
        await orchestrator.ready;
        socket.send('ready');
      });

      if (heartbeat) {
        // We want to time out even if we never hear the initial heartbeat
        that.stopLater();
      }
    });

    this._server.listen(6785);
    log.info('Listening for connections from ember-cli...');
  }

  _stop() {
    log.info('No heartbeat from ember-cli! Shutting down.');
    this.orchestrator.stop();
  }
};
