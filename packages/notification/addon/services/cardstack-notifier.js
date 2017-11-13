import Ember from 'ember';
import SocketIo from 'socket-io';
import { socketIoUrl } from '@cardstack/cardstack-notifier/environment';

export default Ember.Service.extend({
  cardstackSession: Ember.inject.service(),

  connect() {
    let session = this.get("cardstackSession");
    if (!session || !session.get("isAuthenticated")) {
      Ember.Logger.warn(`Cannot connect to socket.io, as there is no authenticated session`);
      return;
    }

    let userId = session.get("user.id");
    let token = session.get("_rawSession.data.meta.token");
    if (!userId || !token) {
      Ember.Logger.warn(`Cannot connect to socket.io, as there is no userId and/or session token`);
      return;
    }

    let socket = SocketIo(socketIoUrl);

    this.set("socket", socket);

    Ember.Logger.info(`Connecting to socket.io with userId '${userId}' and token '${token}'`);
    socket.emit("user", { userId, token });

    socket.on("notification", body => {
      Ember.Logger.info("Notification received", JSON.stringify(body, null, 2));
      //TODO fetch the data whose ID appears in the message
    });
    socket.on("invalid-session", ()=> {
      Ember.Logger.warn("Cannot connect to socket.io, invalid session for token ", token);
      this.disconnect();
    });
  },

  disconnect() {
    let socket = this.get("socket");
    if (!socket) { return; }

    socket.disconnect();
  },
});
