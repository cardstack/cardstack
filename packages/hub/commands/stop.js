const {connect} = require('../docker-host/hub-connection');

module.exports = {
  name: 'hub:stop',
  description: "Stops the Cardstack Hub's Docker container",

  works: 'insideProject',

  availableOptions: [],

  async run() {
    let hub;
    try {
      hub = await connect();
    } catch (e) {
      throw new Error("There doesn't seem to be a hub running");
    }

    this.ui.writeLine("Sending shutdown message to hub...");
    hub.shutdown();
  }
};
