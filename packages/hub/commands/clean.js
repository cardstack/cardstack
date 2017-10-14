const {spawn} = require('child_process');

const {waitForExit} = require('../util/process');
const crawlPackages = require('../docker-host/crawl-module-linkages');
const buildAppImage = require('../docker-host/build-image');
const startHubContainer = require('../docker-host/start-hub-container');
const {connect} = require('../docker-host/hub-connection');

module.exports = {
  name: 'hub:clean',
  description: "Cleans up Docker artifacts left by running the hub",

  works: 'insideProject',

  availableOptions: [],

  async run(args) {
    this.ui.writeLine("Cleaning up old hub containers...");
    let proc = spawn('docker', ['container', 'prune', '-f', '--filter', 'label=com.cardstack'], {stdio: 'inherit'});
    await waitForExit(proc);
  }
};
