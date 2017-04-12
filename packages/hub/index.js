const { makeServer } = require('./main');
const path = require('path');
const crypto = require('crypto');

module.exports = {
  name: '@cardstack/hub',

  included(){
    this._super.apply(this, arguments);
    this.seedPath = path.join(path.dirname(this.project.configPath()), '..', 'cardstack', 'seeds');
  },

  // The serverMiddleware hook is well-behaved and will wait for us to
  // resolve a promise before moving on.
  async serverMiddleware({ app, options }) {
    let { project, environment } = options;
    let seedFile = path.join(this.seedPath, environment + '.js');
    app.use('/cardstack', await this._middleware(seedFile, project.ui));
  },

  // testemMiddleware will not wait for a promise, so we need to
  // register something immediately. This is racy and makes it
  // possible for early requests to fail -- if that turns out to have
  // a practical effect we will need to queue requests here instead.
  testemMiddleware(app) {
    let seedFile = path.join(this.seedPath, 'test.js');
    let handler;
    this._middleware(seedFile).then(h => handler = h);
    app.use('/cardstack', (req, res) => {
      if (handler) {
        handler(req, res);
      } else {
        res.status = 500;
        res.send("Server not ready yet");
        res.end();
      }
    });
  },

  _middleware(seedFile, ui) {
    let seedModels = [];
    try {
      seedModels = require(seedFile);
    } catch (err) {
      if (ui) {
        ui.writeWarnLine(`Unable to load your seed models (looking for ${seedFile})`);
      } else {
        process.stderr.write(`Unable to load your seed models (looking for ${seedFile})\n`);
      }
    }

    // Without this node 7 swallows stack traces within the native
    // promises I'm using.
    process.on('warning', (warning) => {
      process.stderr.write(warning.stack);
    });

    // Randomized session encryption -- this means if you restart the
    // dev server your session gets invalidated.
    let sessionsKey = crypto.randomBytes(32);
    return makeServer(sessionsKey, seedModels).then(server => {
      return server.callback();
    });
  }

};
