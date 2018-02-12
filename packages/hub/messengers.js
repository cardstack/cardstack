const { declareInjections } = require('@cardstack/di');
const Error = require('@cardstack/plugin-utils/error');
const Session = require('@cardstack/plugin-utils/session');

module.exports = declareInjections({
  plugins: 'hub:plugins',
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
      let sink = await this.searchers.getFromControllingBranch(Session.INTERNAL_PRIVLEGED, 'message-sinks', sinkId);

      if (!sink) {
        throw new Error(`Tried to send a message to message sink ${sinkId} but it does not exist`, { status: 500 });
      }

      let Plugin = (await this.plugins.active()).lookupFeatureFactoryAndAssert('messengers', sink.data.attributes['messenger-type']);
      let messenger = Plugin.create(Object.assign({ sinkId },  sink.data.attributes.params));

      this.messengerCache[sinkId] = messenger;

      return messenger;
    }
  }
});
