const {waitForExit} = require('../util/process');
const crawlPackages = require('../docker-host/crawl-module-linkages');
const buildAppImage = require('../docker-host/build-image');
const startHubContainer = require('../docker-host/start-hub-container');
const {connect} = require('../docker-host/hub-connection');

module.exports = {
  name: 'hub:start',
  description: "Starts the Cardstack hub in a Docker container",

  works: 'insideProject',

  availableOptions: [
    /*{
      name: 'follow',
      aliases: ['f'],
      type: Boolean
      default: false
    }*/
  ],

  async run(args) {
    let packages = await crawlPackages(this.project.root);
    let proc = buildAppImage(packages, this.project.pkg.name);
    this.ui.writeLine("Building your docker image...");
    proc.stdout.pipe(process.stdout);
    proc.stderr.pipe(process.stderr);
    await waitForExit(proc);

    this.ui.writeLine("Starting hub container...");
    let container_id = await startHubContainer();

    if (args.follow) {
      this.ui.writeLine('not yet implemented');
    } else {
      this.ui.writeLine(`The hub has started. Use "docker logs -f ${container_id}" to see its output`);
    }
  }
};
