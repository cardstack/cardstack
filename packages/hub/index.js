const { makeServer } = require('./main');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const log = require('@cardstack/plugin-utils/logger')('hub/ember-cli');
const Funnel = require('broccoli-funnel');
const CONTAINER_MODE = process.env.CONTAINERIZED_HUB != null;
const NewBroccoliConnector = require('./docker-host/broccoli-connector');
const proxyToHub = require('./docker-host/proxy-to-hub');

// TODO: move into configuration
const defaultBranch = 'master';

let addon = {
  name: '@cardstack/hub',

  includedCommands() {
    if (CONTAINER_MODE) {
      return {
        'hub:build': require('./commands/build'),
        'hub:start': require('./commands/start'),
        'hub:stop': require('./commands/stop'),
        'hub:prune': require('./commands/prune')
      };
    } else {
      return {
        'hub:start': require('./commands/start-native')
      };
    }
  },

  init() {
    this._super.init && this._super.init.apply(this, arguments);

    // We don't want to boot the hub multiple times, even if it gets
    // included by multiple addons. So we do a bit of global
    // coordination here and only the first instance takes effect.
    if (global.__cardstack_hub_running_in_ember_cli) {
      this._active = false;
      return;
    } else {
      global.__cardstack_hub_running_in_ember_cli = true;
      this._active = true;
    }
  },

  included(app){
    while (app.app) {
      app = app.app;
    }
    let env = this.env = app.env;
    this._super.apply(this, arguments);
    if (!this._active){ return; }

    if (env === 'test') {
      let OldBroccoliConnector = require('./broccoli-connector');
      this._broccoliConnector = new OldBroccoliConnector();
      app.import('vendor/cardstack/generated.js');
    } else {
      app.import('vendor/cardstack-generated.js');
    }

    if (!process.env.ELASTICSEARCH_PREFIX) {
      process.env.ELASTICSEARCH_PREFIX = this.project.pkg.name.replace(/^[^a-zA-Z]*/, '').replace(/[^a-zA-Z0-9]/g, '_') + '_' + env;
    }

    // start spinning up the hub immediately, because our treeFor*
    // hooks won't resolve until the hub does its first codegen build,
    // and the middleware hooks won't run until after that.

    if (env === 'test') {
      let seedPath = path.join(path.dirname(this.project.configPath()), '..', 'cardstack', 'seeds', env);
      let useDevDeps = true;
      this._hubMiddleware = this._makeServer(seedPath, this.project.ui, useDevDeps, env);
    }
  },

  // The serverMiddleware hook is well-behaved and will wait for us to
  // resolve a promise before moving on.
  async serverMiddleware({ app }) {
    if (!this._active){
      this._super.apply(this, arguments);
      return;
    }
    app.use('/cardstack', proxyToHub());
  },

  // testemMiddleware will not wait for a promise, so we need to
  // register something immediately. This is racy and makes it
  // possible for early requests to fail -- if that turns out to have
  // a practical effect we will need to queue requests here instead.
  testemMiddleware(app) {
    if (!this._active){
      this._super.apply(this, arguments);
      return;
    }

    let handler;
    this._hubMiddleware.then(
      h => { handler = h; },
      error => {
        log.error("Server failed to start. %s", error);
        handler = (req, res) => {
          res.status = 500;
          res.send("@cardstack/hub server failed to start due to exception: " + error);
          res.end();
        };
      }
    );
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


  treeForVendor() {
    if (!this._active){
      this._super.apply(this, arguments);
      return;
    }
    if (this.env !== 'test') {
      return new NewBroccoliConnector(defaultBranch).tree;
    } else {
      return new Funnel(this._broccoliConnector.tree, {
        srcDir: defaultBranch,
        destDir: 'cardstack'
      });
    }
  },

  buildError(error) {
    if (this._broccoliConnector) {
      this._broccoliConnector.buildFailed(error);
    }
  },

  postBuild(results) {
    if (this._broccoliConnector) {
      this._broccoliConnector.buildSucceeded(results);
    }
  },

  async _makeServer(seedDir, ui, allowDevDependencies, env) {
    log.debug("Looking for seed files in %s", seedDir);
    let seedModels;
    try {
      seedModels = fs.readdirSync(seedDir).map(filename => {
        if (/\.js/.test(filename)) {
          log.debug("Found seed file %s", filename);
          return require(path.join(seedDir, filename));
        }
      }).filter(Boolean).reduce((a,b) => a.concat(b), []);
    } catch (err) {
      if (err.code === 'ENOENT') {
        let message = `@cardstack/hub found no seed model directory (looking for ${seedDir})`;
        if (ui) {
          ui.writeWarnLine(message);
        } else {
          process.stderr.write(message);
        }
        seedModels = [];
      } else {
        throw err;
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

    try {
      let koaApp = await makeServer(this.project.root, sessionsKey, seedModels, {
        allowDevDependencies,
        broccoliConnector: this._broccoliConnector,
        emberConfigEnv: require(this.project.configPath())(env)
      });
      return koaApp.callback();
    } catch (err) {
      // we don't want to leave our broccoli build hanging forever,
      // because ember-cli waits for it to exit before doing its own
      // cleanup and exiting, meaning we could get an unkillable
      // ember-cli.
      this._broccoliConnector.setSource(Promise.reject(err));
      throw err;
    }
  }
};
module.exports = addon;
