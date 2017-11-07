const { spawn } = require('child_process');
const { waitForExit } = require('../util/process');
const path = require('path');

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
    if (!process.env.CARDSTACK_SESSIONS_KEY) {
      const crypto = require('crypto');
      let key = crypto.randomBytes(32);
      process.env.CARDSTACK_SESSIONS_KEY = key.toString('base64');
    }
    if (!process.env.DEBUG) {
      process.env.DEBUG = 'cardstack/*';
    }
    if (!process.env.DEBUG_COLORS) {
      process.env.DEBUG_COLORS='yes';
    }

    // I think this flag needs to get refactored away, it's always the
    // right behavior to have it turned on, there's no time that your
    // app will be installed without the devDeps present. So the
    // distinction really only matters for addons. And even when
    // inside an addon running the dummy app, devDeps should always be
    // included.
    let flags = ['--allow-dev-dependencies'];

    let seedDir = path.join(path.dirname(this.project.configPath()),
                            '..', 'cardstack', 'seeds', args.environment);

    let proc = spawn('npx', ['cardstack-hub', ...flags, seedDir]);
    proc.stdout.pipe(this.ui.outputStream, {end: false});
    proc.stderr.pipe(this.ui.errorStream, {end: false});
    await waitForExit(proc);
  }

};
