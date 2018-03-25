const path = require('path');
const { spawn } = require('child_process');
const { prepareSpawnHub } = require('./start-native');
const { waitForExit } = require('../util/process');

module.exports = {
  name: 'hub:seed',
  description: "Loads seed models into Cardstack hub.",

  works: 'insideProject',

  availableOptions: [
    {
      name: 'environment',
      aliases: ['e', { 'dev': 'development' }, { 'prod': 'production' }],
      description: 'Possible values are "development", "production", and "test".',
      type: String,
      default: 'development'
    },
  ],

  async run(args) {
    this.ui.writeLine("Starting to load seed models...");
    await this.loadSeedModels(this.project.pkg.name, this.project.configPath(), args.environment);
  },

  async loadSeedModels(packageName, configPath, environment) {
    let { setEnvVars, args } = prepareSpawnHub(packageName, configPath, environment);

    for (let [key, value] of Object.entries(setEnvVars)) {
      process.env[key] = value;
    }

    let bin = path.resolve(path.join(__dirname, '..', 'bin', 'seed-models.js'));
    let proc = spawn(process.execPath, [bin, ...args], { stdio: [0, 1, 2, 'ipc']  });

    await waitForExit(proc);
  },
};
