const { spawnHub } = require('../main');
const { waitForExit } = require('../util/process');

module.exports = {
  name: 'hub:start',
  description: "Starts the Cardstack hub",
  works: 'insideProject',

  availableOptions: [
    {
      name: 'environment',
      aliases: ['e', { 'dev': 'development' }, { 'prod': 'production' }],
      description: 'Possible values are "development", "production", and "test".',
      type: String,
      default: 'development'
    }
  ],

  async run(args) {
    let proc = spawnHub(this.project.pkg.name, this.project.configPath(), args.environment);
    await waitForExit(proc);
  }

};
