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
    let proc = spawn('npx', ['cardstack-hub', path.join(this.project.root, 'cardstack', 'seeds', args.environment)]);
    proc.stdout.pipe(this.ui.outputStream, {end: false});
    proc.stderr.pipe(this.ui.errorStream, {end: false});
    await waitForExit(proc);
  }
};
