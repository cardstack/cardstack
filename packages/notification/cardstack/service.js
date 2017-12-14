const log = require('@cardstack/plugin-utils/logger')('cardstack/notification');
const Session = require('@cardstack/plugin-utils/session');
const { declareInjections } = require('@cardstack/di');
const messengerName = 'socket-notification';

const DEFAULT_SOCKET_IO_PORT = 3100;

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

  // TODO is this the right place for this?
  // The goal of this method is to provide type specific socket validation,
  // as some notification types will require authorization in order to connect (like users)
  get socketSubscriber() {
    return {
      users: (socket, id, token) => {
        let session = this._tokenToSession(token);

        if (!session || !session.payload || session.payload.id !== id) {
          socket.emit("invalid-session", { error: `Cannot subscribe to user '${id}' with token '${token}', invalid token supplied` });
          return;
        }
        log.info(`Socket id '${socket.id}' identified as user '${id}'`);
        socket.join(`users:${id}`);
        log.debug(`joined '${socket.id}' to room 'user:${id}'`);
      }
    };
  }

  async start() {
    if (this.hasStarted) { return; }

    this.hasStarted = true;

    await this.messengers.getMessenger(messengerName).then(({
      internalSocketIoPort,
      internalSocketIoPath,
      notificationTest
    }) => {
      internalSocketIoPath = internalSocketIoPath || '/';
      internalSocketIoPort = internalSocketIoPort || DEFAULT_SOCKET_IO_PORT;

      log.info(`starting socket.io on port ${internalSocketIoPort} at path ${internalSocketIoPath}`);
      this.server = require('socket.io')(internalSocketIoPort, {
        internalSocketIoPath,
        serveClient: false,
      });

      this.server.on("connection", socket => {
        log.debug(`Received a connection, socket id '${socket.id}'`);

        socket.on('subscribe', ({ type, id, token }) => {
          if (typeof this.socketSubscriber[type] === "function") {
            this.socketSubscriber[type](socket, id, token);
          } else {
            socket.join(`${type}:${id}`);
            log.debug(`joined '${socket.id}' to room '${type}:${id}'`);
          }
        });

        socket.on('unsubscribe', ({ type, id }) => {
          socket.leave(`${type}:${id}`);
        });

        socket.on('disconnect', () => {
          log.debug(`socket disconnected, socket id '${socket.id}'`);
        });
      });

      // TODO move this into a seperate place--how about the dummy app?
      if (notificationTest) {
        let { userType, userId, messageType, intervalSec } = notificationTest;
        setInterval(async () => {
          // let user = await this.userSearcher.get(userType, 'user1');
          // console.log("GOT USER", user);

          this.messengers.send(messengerName, {
            type: "users",
            id: "user1",
            body: `The time is now ${new Date()}`
          });
        }, notificationTest.intervalSec * 1000);
      }
    });

  }
});
