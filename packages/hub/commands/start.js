const { spawn } = require('child_process');

const { waitForExit } = require('../util/process');
const crawlPackages = require('../docker-host/crawl-module-linkages');
const buildAppImage = require('../docker-host/build-image');
const startHubContainer = require('../docker-host/start-hub-container');
const { connect } = require('../docker-host/hub-connection');

module.exports = {
  name: 'hub:start',
  description: 'Starts the Cardstack hub in a Docker container',

  works: 'insideProject',

  availableOptions: [
    {
      name: 'follow',
      aliases: ['f'],
      type: Boolean,
      default: false,
    },
    {
      name: 'environment',
      aliases: ['e', { dev: 'development' }, { prod: 'production' }],
      description: 'Possible values are "development", "production", and "test".',
      type: String,
      default: 'development',
    },
  ],

  async run(args) {
    let packages = await crawlPackages(this.project.root);
    let proc = buildAppImage(packages, this.project.pkg.name);
    this.ui.writeLine('Building your docker image...');
    proc.stdout.pipe(this.ui.outputStream, { end: false });
    proc.stderr.pipe(this.ui.errorStream, { end: false });
    await waitForExit(proc);

    this.ui.writeLine('Starting hub container...');
    let container_id = await startHubContainer({
      appName: this.project.pkg.name,
      env: args.environment,
    });

    if (args.follow) {
      this.ui.writeLine('The hub container has been started. Now tailing the logs:');
      let logs = spawn('docker', ['logs', '-f', container_id]);
      logs.stdout.pipe(this.ui.outputStream, { end: false });
      logs.stderr.pipe(this.ui.errorStream, { end: false });
      return waitForExit(logs);
    } else {
      this.ui.writeLine('Waiting for the hub to fully boot:');
      let logs = spawn('docker', ['logs', '-f', container_id]);
      logs.stdout.pipe(this.ui.outputStream, { end: false });
      logs.stderr.pipe(this.ui.errorStream, { end: false });
      let connection;
      try {
        connection = await connect();
      } catch (e) {
        logs.stdout.unpipe();
        logs.stderr.unpipe();
        return Promise.reject('The hub seems to have crashed while starting up');
      }
      await connection.ready;
      logs.stdout.unpipe();
      logs.stderr.unpipe();
      this.ui.writeLine(
        `The hub is now handling requests. Use "docker logs -f ${container_id}" to see the rest of its output`
      );
    }
  },
};
