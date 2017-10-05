const stream = require('stream');

const {waitForExit} = require('../util/process');
const buildAppImage = require('../docker-host/build-image');

module.exports = {
  name: 'hub:build',
  description: "Builds the docker image to run the Cardstack hub for this app",

  works: 'insideProject',

  availableOptions: [
    {
      name: 'tag',
      aliases: ['t'],
      type: String,
      default: 'cardstack-app:latest',
    }
  ],

  async run(args) {
    let proc = buildAppImage();
    this.ui.writeLine("Building your docker image...");
    proc.stdout.pipe(this.ui.outputStream);
    await waitForExit(proc);
  }
}
