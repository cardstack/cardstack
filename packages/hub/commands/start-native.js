const path = require('path');
const { spawn } = require('child_process');

module.exports = {
  name: 'hub:start',
  description: "Start the Cardstack hub for local development and testing",
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
      let { setEnvVars, bin, args: shellArgs } = await this.prepareSpawnHub(this.project.pkg.name, this.project.configPath(), args.environment, args.port, args.url);
      for (let [key, value] of Object.entries(setEnvVars)) {
        process.stdout.write(`export ${key}=${value}\n`);
      }
      process.stdout.write(`${bin} ${shellArgs.join(' ')}\n`);
    } else {
      await this.spawnHub(this.project.pkg.name, this.project.configPath(), args.environment, args.port, args.url);
    }
    await new Promise(() => {});
  },

  prepareSpawnHub(packageName, configPath, environment, port, explicitURL) {
    let setEnvVars = Object.create(null);
    if (!process.env.CARDSTACK_SESSIONS_KEY) {
      const crypto = require('crypto');
      let key = crypto.randomBytes(32);
      setEnvVars.CARDSTACK_SESSIONS_KEY = key.toString('base64');
    }

    if (!process.env.ELASTICSEARCH_PREFIX) {
      setEnvVars.ELASTICSEARCH_PREFIX = packageName.replace(/^[^a-zA-Z]*/, '').replace(/[^a-zA-Z0-9]/g, '_') + '_' + environment;
    }

    if (!process.env.INITIAL_DATA_DIR) {
      setEnvVars.INITIAL_DATA_DIR = path.join(path.dirname(configPath),
                                              '..', 'cardstack');

    }

    if (explicitURL) {
      setEnvVars.HUB_URL = explicitURL;
    }

    setEnvVars.PORT = port;

    let bin = path.resolve(path.join(__dirname, '..', 'bin', 'cardstack-hub.js'));

    let args = [];

    return { setEnvVars, bin, args };
  },

  async spawnHub(packageName, configPath, environment, port, url) {
    let { setEnvVars, bin, args } = this.prepareSpawnHub(packageName, configPath, environment, port, url);

    for (let [key, value] of Object.entries(setEnvVars)) {
      process.env[key] = value;
    }

    let proc = spawn(process.execPath, [bin, ...args], { stdio: [0, 1, 2, 'ipc']  });
    await new Promise((resolve, reject) => {
      // by convention the hub will send a hello message if it sees we
      // are supervising it over IPC. If we get an error or exit before
      // that, it's a failure to spawn the hub.
      proc.on('message', message => {
        if (message === 'hub hello') {
          resolve();
        }
      });
      proc.on('error', reject);
      proc.on('exit', reject);
    });
    return `http://localhost:${port}`;
  }
};
