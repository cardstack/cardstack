const {
  spawnHub,
  prepareSpawnHub
} = require('../main');

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
    },
    {
      name: 'print',
      description: 'Instead of starting the hub, print the startup command(s) we would run.',
      aliases: ['p'],
      type: Boolean,
      default: false
    }
  ],

  async run(args) {
    if (args.print) {
      let { setEnvVars, bin, args: shellArgs } = await prepareSpawnHub(this.project.pkg.name, this.project.configPath(), args.environment);
      for (let [key, value] of Object.entries(setEnvVars)) {
        process.stdout.write(`${key}=${value}\n`);
      }
      process.stdout.write(`${bin} ${shellArgs.join(' ')}\n`);
    } else {
      await spawnHub(this.project.pkg.name, this.project.configPath(), args.environment);
    }
    await new Promise(() => {});
  }

};
