const assert = require('assert');
const { declareInjections } = require('@cardstack/di');
const logger = require('@cardstack/plugin-utils/logger')('cardstack/notification');

module.exports = declareInjections({
  service: `plugin-services:${require.resolve('./service')}`
},

class NotificationMessenger {
  send({userId, body}) {
    assert(userId, "A user-notification` message must have a userId property");
    logger.info(`send message to room user:${userId}: ${JSON.stringify(body, null, 2)}`);
    this.service.server.to(`user:${userId}`).emit("notification", body);
  }
});

