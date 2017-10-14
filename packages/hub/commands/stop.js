const {spawn} = require('child_process');

const {waitForExit} = require('../util/process');
const crawlPackages = require('../docker-host/crawl-module-linkages');
const buildAppImage = require('../docker-host/build-image');
const startHubContainer = require('../docker-host/start-hub-container');
const {connect} = require('../docker-host/hub-connection');

module.exports = {
  name: 'hub:stop',
  description: "Stops the Cardstack Hub's Docker container",

  works: 'insideProject',

  availableOptions: [],

  async run(args) {
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
