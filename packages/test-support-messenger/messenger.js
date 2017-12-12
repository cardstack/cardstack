const log = require('@cardstack/logger')('cardstack/messengers');

module.exports = class TestMessenger {
  static create(params) {
    log.debug("Created test messenger with params", params);
    return new this(params);
  }
  constructor(params) {
    this.params = params;
    this.sentMessages = [];
  }
  send(message) {
    log.debug("Sent a message with test messenger", message);
    this.sentMessages.push({ message, params: this.params });
    log.info(JSON.stringify(message, null, 2));
  }
  static async sentMessages(env) {
    log.debug("Looking up the test messenger", env);
    let messengers = await env.lookup('hub:messengers');
    let cachedMessengers = Object.values(messengers.messengerCache);
    return cachedMessengers.reduce( (memo, messenger) =>  messenger.sentMessages.concat(memo), []);
  }
};
