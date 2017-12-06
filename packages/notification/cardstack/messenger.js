const assert = require('assert');
const { declareInjections } = require('@cardstack/di');
const logger = require('@cardstack/plugin-utils/logger')('cardstack/notification');

module.exports = declareInjections({
  service: `plugin-services:${require.resolve('./service')}`
},

class NotificationMessenger {
  send({type, id, body}) {
    assert(type && id, "A socket-notification` message must have a 'type' and an 'id' property");
    logger.info(`send message to room ${type}:${id}: ${JSON.stringify(body, null, 2)}`);
    this.service.server.to(`${type}:${id}`).emit("notification", body);
  }
});

