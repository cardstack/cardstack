module.exports = class TestMessenger {
  static create() {
    return new this();
  }
  constructor() {
    this.sentMessages = [];
  }
  send(message, params) {
    this.sentMessages.push({ message, params });
  }
  static async sentMessages(env) {
    let schema = await env.lookup('hub:schema-cache').schemaForControllingBranch();
    let plugin = schema.plugins.lookupFeatureAndAssert('messengers', '@cardstack/test-support/messenger');
    return plugin.sentMessages;
  }
};
