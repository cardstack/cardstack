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
      name: 'port',
      aliases: ['p'],
      description: 'Port to listen on',
      type: Number,
      default: 3000
    },
    {
      name: 'url',
      aliases: ['d'],
      description: 'Public URL at which clients will be able to talk to the Hub. For production use you will almost always need to set this. For local development, you can leave it unset and it will default to localhost on the configured listen port.',
      type: String
    },
    {
      name: 'print',
      description: 'Instead of starting the hub, print the startup command(s) we would run.',
      aliases: ['r'],
      type: Boolean,
      default: false
    }
  ],

  async run(args) {
    if (args.print) {
      let { setEnvVars, bin, args: shellArgs } = await prepareSpawnHub(this.project.pkg.name, this.project.configPath(), args.environment, args.port, args.url);
      for (let [key, value] of Object.entries(setEnvVars)) {
        process.stdout.write(`${key}=${value}\n`);
      }
      process.stdout.write(`${bin} ${shellArgs.join(' ')}\n`);
    } else {
      await spawnHub(this.project.pkg.name, this.project.configPath(), args.environment, args.port, args.url);
    }
    await new Promise(() => {});
  }

};
