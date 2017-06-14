const logger = require('heimdalljs-logger')('messengers');


module.exports = class TestMessenger {
  static create(params) {
    return new this(params);
  }
  constructor(params) {
    this.params = params;
    this.sentMessages = [];
  }
  send(message) {
    this.sentMessages.push({ message, params: this.params });
    logger.info(JSON.stringify(message, null, 2));
  }
  static async sentMessages(env) {
    let schema = await env.lookup('hub:schema-cache').schemaForControllingBranch();
    let plugin = schema.plugins.lookupFeatureAndAssert('messengers', '@cardstack/test-support/messenger');
    return plugin.sentMessages;
  }
};
