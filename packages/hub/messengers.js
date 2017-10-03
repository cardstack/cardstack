const { declareInjections } = require('@cardstack/di');
const Error = require('@cardstack/plugin-utils/error');

module.exports = declareInjections({
  schemaCache: 'hub:schema-cache',
  searchers: 'hub:searchers'
},

class Messengers {
  constructor() {
    this.messengerCache = {};
  }

  async send(sinkId, message) {
    let messenger = await this.getMessenger(sinkId);

    return await messenger.send(message);
  }

  async getMessenger(sinkId) {
    if (this.messengerCache[sinkId]) {
      return this.messengerCache[sinkId];
    } else {
      let sink = await this.searchers.get(this.schemaCache.controllingBranch, 'message-sinks', sinkId);

      if (!sink) {
        throw new Error(`Tried to send a message to message sink ${sinkId} but it does not exist`, { status: 500 });
      }

      let schema = await this.schemaCache.schemaForControllingBranch();
      let Plugin = schema.plugins.lookupFeatureFactoryAndAssert('messengers', sink.data.attributes['messenger-type']);
      let messenger = Plugin.create(Object.assign({ sinkId },  sink.data.attributes.params));

      this.messengerCache[sinkId] = messenger;

      return messenger;
    }
  }
});
