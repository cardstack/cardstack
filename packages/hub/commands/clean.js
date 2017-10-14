const {spawn} = require('child_process');

const {waitForExit} = require('../util/process');

module.exports = {
  name: 'hub:clean',
  description: "Cleans up Docker artifacts left by running the hub",

  works: 'insideProject',

  availableOptions: [],

  async run() {
    this.ui.writeLine("Cleaning up old hub containers...");
    let proc = spawn('docker', ['container', 'prune', '-f', '--filter', 'label=com.cardstack'], {stdio: 'inherit'});
    await waitForExit(proc);
  }
};
