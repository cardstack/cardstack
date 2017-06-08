const { makeServer } = require('./main');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const quickTemp = require('quick-temp');
const { WatchedDir } = require('broccoli-source');
const Funnel = require('broccoli-funnel');

module.exports = {
  name: '@cardstack/hub',

  init() {
    this._super.init && this._super.init.apply(this, arguments);
    quickTemp.makeOrRemake(this, '_codeGenDir', 'cardstack-hub');
    fs.mkdirSync(this._codeGenDir + '/app');
    fs.mkdirSync(this._codeGenDir + '/addon');
    this._sourceTree = new WatchedDir(this._codeGenDir, { annotation: '@cardstack/hub' });
  },

  treeForAddon() {
    return this._super.treeForAddon.call(
      this,
      new Funnel(this._sourceTree, { srcDir: 'addon' })
    );
  },

  treeForApp() {
    return new Funnel(this._sourceTree, { srcDir: 'app' });
  },

  included(){
    this._super.apply(this, arguments);
    this.seedPath = path.join(path.dirname(this.project.configPath()), '..', 'cardstack', 'seeds');
  },

  // The serverMiddleware hook is well-behaved and will wait for us to
  // resolve a promise before moving on.
  async serverMiddleware({ app, options }) {
    let { pkg } = this.project;

    // if the hub is a runtime dependency, it should only load other
    // plugins that are also runtime dependencies. If it's a
    // devDependency, it will also load other plugins that are
    // devDependencies.
    let useDevDeps = !(pkg.dependencies && pkg.dependencies['@cardstack/hub']);

    let { project, environment } = options;
    let seedDir = path.join(this.seedPath, environment);
    app.use('/cardstack', await this._middleware(seedDir, project.ui, useDevDeps, environment));
  },

  // testemMiddleware will not wait for a promise, so we need to
  // register something immediately. This is racy and makes it
  // possible for early requests to fail -- if that turns out to have
  // a practical effect we will need to queue requests here instead.
  testemMiddleware(app) {
    let seedDir = path.join(this.seedPath, 'test');
    let handler;
    this._middleware(seedDir, null, true, 'test').then(h => handler = h);
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

  _middleware(seedDir, ui, allowDevDependencies, environment) {
    if (!process.env.ELASTICSEARCH_PREFIX) {
      process.env.ELASTICSEARCH_PREFIX = this.project.pkg.name.replace(/^[^a-zA-Z]*/, '').replace(/[^a-zA-Z0-9]/g, '_') + '_' + environment;
    }

    let seedModels;
    try {
      seedModels = fs.readdirSync(seedDir).map(filename => require(path.join(seedDir, filename))).reduce((a,b) => a.concat(b), []);
    } catch (err) {
      if (ui) {
        ui.writeWarnLine(`Unable to load your seed models (looking for ${seedDir})`);
      } else {
        process.stderr.write(`Unable to load your seed models (looking for ${seedDir})\n`);
      }
      seedModels = [];
    }

    // Without this node 7 swallows stack traces within the native
    // promises I'm using.
    process.on('warning', (warning) => {
      process.stderr.write(warning.stack);
    });

    // Randomized session encryption -- this means if you restart the
    // dev server your session gets invalidated.
    let sessionsKey = crypto.randomBytes(32);

    return makeServer(this.project.root, sessionsKey, seedModels, {
      allowDevDependencies,
      codeGenDirectory: this._codeGenDir
    }).then(server => {
      return server.callback();
    });
  }

};
