const runProject = require('./container-stuff/run-project');

module.exports = {
  name: 'hub:start',
  description: `Assemble the @cardstack/hub server from your app's plugins`,
  works: 'insideProject',

  anonymousOptions: [],
  availableOptions: [],

  async run(commandOptions, rawArgs) {
    this.ui.writeLine('hello world');
    await runProject(this.project.root);
  }

};
