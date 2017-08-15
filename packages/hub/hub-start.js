const path = require('path');
const crawlLinkedModules = require('./container-stuff/list-linked-packages');
const startHubService = require('./container-stuff/start-hub-service');

module.exports = {
  name: 'hub:start',
  description: `Kick off a detached hub server`,
  works: 'insideProject',

  anonymousOptions: [],
  availableOptions: [],

  async run(commandOptions, rawArgs) {
    this.ui.writeLine('running hub:start');

    let projectRoot = this.project.root;
    let seedDir = path.join(path.dirname(this.project.configPath()), '..', 'cardstack', 'seeds', 'development');
    let projectStructure = crawlLinkedModules(projectRoot);

    startHubService({
      projectRoot,
      projectStructure,
      seedDir,
      useDevDependencies: true
    });
    // let packages = crawlLinkedModules()
    // await runProject(this.project.root);
  }

};
