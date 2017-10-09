const stream = require('stream');

const {waitForExit} = require('../util/process');
const crawlPackages = require('../docker-host/crawl-module-linkages');
const buildAppImage = require('../docker-host/build-image');

module.exports = {
  name: 'hub:build',
  description: "Builds the docker image to run the Cardstack hub for this app",

  works: 'insideProject',

  availableOptions: [
    /* {
      name: 'tag',
      aliases: ['t'],
      type: String,
      default: 'cardstack-app:latest',
    } */
  ],

  async run(args) {
    let packages = await crawlPackages(this.project.root);
    let proc = buildAppImage(packages);
    this.ui.writeLine("Building your docker image...");
    proc.stdout.pipe(process.stdout);
    await waitForExit(proc);
  }
}
