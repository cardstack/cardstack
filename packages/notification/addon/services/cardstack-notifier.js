import Ember from 'ember';
import SocketIo from 'socket-io';
import { socketIoUrl } from '@cardstack/cardstack-notifier/environment';

export default Ember.Service.extend({

  subscribe(query) {
    let { type, filter, token } = query;
    let id = filter.user_id; // dont  do this for real!!


    let socket = this.get("socket");
    if (!socket) {
      Ember.Logger.info(`Connecting to socket.io at url: ${socketIoUrl}`);
      socket = SocketIo(socketIoUrl);
      this.set("socket", socket);

      socket.on("notification", body => {
        Ember.Logger.info("Notification received", JSON.stringify(body, null, 2));
        //TODO fetch the data whose ID appears in the message
      });
      socket.on("invalid-session", error => {
        Ember.Logger.warn("Cannot subscribe invalid session for token ", token, error);
      });
    }

    // TODO handle other types of filters besides `id`
    Ember.Logger.info("subscribing ", JSON.stringify(query));
    socket.emit("subscribe", { type, id, token });
  },

  unsubscribe(query) {
    Ember.Logger.info("unsubscribing ", JSON.stringify(query));
    let socket = this.get("socket");
    if (!socket) { return; }

    let { type, filter } = query;
    let { id } = filter;
    // TODO handle other types of filters besides `id`
    socket.emit("unsubscribe", { type, id });
  },

  // should we ever disconnect?
  disconnect() {
    let socket = this.get("socket");
    if (!socket) { return; }

    socket.disconnect();

    this.set("socket", null);
  },
});
