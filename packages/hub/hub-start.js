const path = require('path');
const crawlLinkedModules = require('./v2-containers/crawl-linked-packages');
const startHubContainer = require('./v2-containers/start-hub-container');
const _ = require('lodash');

module.exports = {
  name: 'hub:start',
  description: `Kick off a detached hub server`,
  works: 'insideProject',

  anonymousOptions: [],
  availableOptions: [],

  async run(commandOptions, rawArgs) {
    this.ui.writeLine('running hub:start');

    let projectName = this.project.pkg.name;
    let projectRoot = this.project.root;
    let seedDir = path.join(path.dirname(this.project.configPath()), '..', 'cardstack', 'seeds', 'development');
    let projectStructure = crawlLinkedModules(projectRoot);

    return startHubContainer({
      projectName,
      projectRoot,
      projectStructure,
      seedDir,
      useDevDependencies: true
    });
  }

};
