const {spawn} = require('child_process');

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
    {
      name: 'follow',
      aliases: ['f'],
      type: Boolean,
      default: false
    }
  ],

  async run(args) {
    let packages = await crawlPackages(this.project.root);
    let proc = buildAppImage(packages, this.project.pkg.name);
    this.ui.writeLine("Building your docker image...");
    proc.stdout.pipe(this.ui.outputStream, {end: false});
    proc.stderr.pipe(this.ui.errorStream, {end: false});
    await waitForExit(proc);

    this.ui.writeLine("Starting hub container...");
    let container_id = await startHubContainer();

    if (args.follow) {
      this.ui.writeLine('The hub container has been started. Now tailing the logs:');
      let logs = spawn('docker', ['logs', '-f', container_id]);
      logs.stdout.pipe(this.ui.outputStream, {end: false});
      logs.stderr.pipe(this.ui.errorStream, {end: false});
      return waitForExit(logs);
    } else {
      this.ui.writeLine(`The hub container has been started. Use "docker logs -f ${container_id}" to see its output`);
      this.ui.writeLine("Waiting for the hub to fully boot...");
      let connection;
      try {
        connection = await connect();
      } catch (e) {
        this.ui.writeLine("The hub seems to have crashed while starting up:");
        let logs = spawn('docker', ['logs', container_id]);
        logs.stderr.pipe(this.ui.errorStream, {end: false});
        return waitForExit(logs);
      }
      await connection.ready;
      this.ui.writeLine("The hub is now handling requests");
    }
  }
};
