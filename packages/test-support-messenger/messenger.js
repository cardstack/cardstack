const logger = require('@cardstack/plugin-utils/logger')('messengers');

module.exports = class TestMessenger {
  static create(params) {
    logger.debug("Created test messenger with params", params);
    return new this(params);
  }
  constructor(params) {
    this.params = params;
    this.sentMessages = [];
  }
  send(message) {
    logger.debug("Sent a message with test messenger", message);
    this.sentMessages.push({ message, params: this.params });
    logger.info(JSON.stringify(message, null, 2));
  }
  static async sentMessages(env) {
    logger.debug("Looking up the test messenger", env);
    let messengers = await env.lookup('hub:messengers');
    let cachedMessengers = Object.values(messengers.messengerCache);
    return cachedMessengers.reduce( (memo, messenger) =>  messenger.sentMessages.concat(memo), []);
  }
};
