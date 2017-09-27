const nssocket = require('nssocket');
const _ = require('lodash');

const orchestrator = require('./orchestrator');
const log = require('@cardstack/plugin-utils/logger')('ember-connection');

const HUB_HEARTBEAT_TIMEOUT = 7.5 * 1000; // longer than the heartbeat interval of 1 second

const stopLater = _.debounce(function() {
  log.info('No heartbeat from ember-cli! Shutting down.');
  orchestrator.stop();
}, HUB_HEARTBEAT_TIMEOUT);


module.exports = class EmberConnector {
  constructor(readyPromise) {
    this._server = nssocket.createServer(async function(socket) {
      log.info('connection established from ember-cli');

      // Docker does some weird stuff for containers with published ports
      // before they start actually listening on the port. Long story short,
      // we need a handshake when we first establish a connection.
      socket.data('hand', function() {
        socket.send('shake');
      });

      // Ember-cli may shut us down manually.
      // Or, if it crashes or is killed it will stop sending the heartbeat
      // and we can clean ourselves up.
      socket.data('shutdown', orchestrator.stop);
      socket.data('heartbeat', function(){
        log.trace('Received a heartbeat from ember-cli');
        stopLater();
      });

      await readyPromise;

      // Our listeners are set up, and whoever instantiated us said we're good,
      // so tell ember-cli everything is ready.
      try {
        socket.send('ready');
      } catch (err) {
        // This happens if ember-cli stopped while we were awaiting readyPromise
        if (/bad socket/.test(err)) {
          log.warn('Ember-cli shut down while the hub was starting. *sigh*');
          orchestrator.stop();
          return;
        } else {
          throw err;
        }
      }

      // We want to time out even if we never hear the initial heartbeat
      stopLater();
    });

    this._server.listen(6785);
    log.info('Listening for connections from ember-cli...');
  }
};
