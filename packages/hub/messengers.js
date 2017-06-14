const { declareInjections } = require('@cardstack/di');
const Error = require('@cardstack/plugin-utils/error');

module.exports = declareInjections({
  schemaCache: 'hub:schema-cache',
  searchers: 'hub:searchers'
},

class Messengers {
  async send(sinkId, message) {
    let sink = await this.searchers.get(this.schemaCache.controllingBranch, 'message-sinks', sinkId);
    if (!sink) {
      throw new Error(`Tried to send a message to message sink ${sinkId} but it does not exist`, { status: 500 });
    }
    let schema = await this.schemaCache.schemaForControllingBranch();
    let Plugin = schema.plugins.lookupFeatureFactoryAndAssert('messengers', sink.attributes['messenger-type']);
    let plugin = Plugin.create(sink.attributes.params);
    return await plugin.send(message);
  }
});
