const log = require('@cardstack/logger')('cardstack/live-queries');
const { declareInjections } = require('@cardstack/di');

const DEFAULT_SOCKET_IO_PORT = 3100;
const DEFAULT_SOCKET_IO_PATH = '/';

module.exports = declareInjections({
  plugins: 'hub:plugins',
  indexers: 'hub:indexers'
},
class LiveQueryService {
  static async create({plugins, indexers}) {
    let instance = new this();

    // This awkward dance is just to get our own plugin config. We also
    // have the dummy middleware, just to get this file loaded so it
    // can start accepting socket connections. We should just add an
    // initializer feature type that gets run on startup, and passed its
    // plugin config.
    // We're happy to start the server in the background though, hence .then()
    plugins.active().then(async function(configured) {
      let ourConfig = configured.describe('@cardstack/live-queries');
      let socketPath = ourConfig.attributes['socket-path'] || DEFAULT_SOCKET_IO_PATH;
      let socketPort = ourConfig.attributes['socket-port'] || DEFAULT_SOCKET_IO_PORT;

      instance.start({socketPath, socketPort});
    });

    instance.listenToIndexer(indexers.events);

    return instance;
  }

  constructor() {
    this._client_subscriptions = new WeakMap();
  }

  async start({socketPath, socketPort}) {
    log.info(`starting socket.io on port ${socketPort} at path ${socketPath}`);
    this.server = require('socket.io')(socketPort, {
      path: socketPath,
      serveClient: false
    });


    this.namespace = this.server.of('/live-queries');
    this.namespace.on("connection", (socket) => {
      log.debug(`Received a connection, socket id '${socket.id}'`);

      let subs = new ClientSubscriptionSet(socket);
      this._client_subscriptions.set(socket, subs);

      socket.on('query-subscribe', subs.subscribe.bind(subs));
      socket.on('query-unsubscribe', subs.subscribe.bind(subs));
    });
  }

  listenToIndexer(indexEvents) {
    indexEvents.on('index_update', () => this._invalidateAll());
  }

  _invalidateAll() {
    let sockets = Object.values(this.namespace.connected);

    sockets.forEach((sock) => {
      let subs = this._client_subscriptions.get(sock);
      subs.subscriptions.forEach(s=>s.invalidate());
    });
  }
});

class ClientSubscriptionSet {
  constructor(socket) {
    this.socket = socket;
    this._subscriptions = {};
  }
  
  get subscriptions() {
    return Object.values(this._subscriptions);
  }

  subscribe(id, type, query) {
    log.debug('Client requesting subscription for %s with query %o', type, query);
    this._subscriptions[id] = new QuerySubscription(this.socket, id, type, query);
  }

  unsubscribe(id) {
    delete this._subscriptions[id];
  }
}

class QuerySubscription {
  constructor(socket, id, type, query) {
    this.socket = socket;
    this.id = id;
    this.type = type;
    this.query = query;
  }

  invalidate() {
    log.trace('Invalidation triggered for live query subscription %s (%s) with query: %o', this.id, this.type, this.query);
    this.socket.emit('query-invalidate', this.id);
  }
}
