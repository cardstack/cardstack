const log = require('@cardstack/plugin-utils/logger')('cardstack/notification');
const Session = require('@cardstack/plugin-utils/session');
const { declareInjections } = require('@cardstack/di');
const messengerName = 'user-notification';

module.exports = declareInjections({
  encryptor: 'hub:encryptor',
  searcher: 'hub:searchers',
  messengers: 'hub:messengers',
},

class NotificationService {
  constructor() {
    // TODO: move these two settings into config
    this.controllingBranch = 'master';
  }

  // TODO move this to more central place? (this is copied from authenticator middleware)
  _tokenToSession(token) {
    try {
      let [sessionPayload, validUntil] = this.encryptor.verifyAndDecrypt(token);
      if (validUntil <= Date.now()/1000) {
        log.debug("Ignoring expired token");
      } else {
        return new Session(sessionPayload, this.userSearcher);
      }
    } catch (err) {
      if (/unable to authenticate data|invalid key length|Not a valid signed message/.test(err.message)) {
        log.warn("Ignoring invalid token");
      } else {
        throw err;
      }
    }
  }

  get userSearcher() {
    return {
      get: (type, userId) => {
        return this.searcher.get(this.controllingBranch, type, userId);
      },
      search: (params) => {
        return this.searcher.search(this.controllingBranch, params);
      }
    };
  }

  async start() {
    if (this.hasStarted) { return; }

    this.hasStarted = true;

    await this.messengers.getMessenger(messengerName).then(({ socketIoUrl }) => {
      if (!socketIoUrl) {
        log.error(`Cannot start socket.io server, no 'socketIoUrl' defined for the '${messengerName}' resouce`);
        return;
      }

      //TODO how do we know this server is actually the host referenced in the scocket.io URL?
      let [ /*url*/, protocol, /*host*/, port, path ] = socketIoUrl.match(/^(http[s]?):\/\/([^:\/]+)(:[\d]+)?(\/.*)?$/);
      path = path || '/';

      if (protocol === "http") {
        port = (port || "80").replace(':', '');
      } else if (protocol === "https") {
        port = (port || "443").replace(':', '');
      }
      if (!port || !path) {
        log.error(`Cannot start socket.io server, cannot derive the server port and path from the 'socketIoUrl' ${socketIoUrl} for the '${messengerName}' resource`);
        return;
      }

      log.info(`starting socket.io on port ${port} at path ${path}`);
      this.server = require('socket.io')(port, {
        path,
        serveClient: false,
      });

      this.server.on("connection", socket => {
        log.debug(`Received a connection, socket id '${socket.id}'`);

        socket.on('user', ({ userId, token }) => {
          let session = this._tokenToSession(token);

          if (!session || !session.payload || session.payload.id !== userId) {
            socket.emit("invalid-session");
            return;
          }

          log.info(`Socket id '${socket.id}' identified as user '${userId}'`);
          socket.join(`user:${userId}`);
          log.debug(`joined '${socket.id}' to room 'user:${userId}'`);
        });
        socket.on('disconnect', () => {
          log.debug(`user disconnected, socket id '${socket.id}'`);
        });
      });
    });

  }
});
