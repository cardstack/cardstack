const { makeServer } = require('./main');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const log = require('@cardstack/plugin-utils/logger')('hub/ember-cli');
// only sometimes load, because of feature flag
let BroccoliConnector;
let Funnel;
let startAndProxyToHubContainer;

const CONTAINER_MODE = process.env.CONTAINERIZED_HUB != null;

if (CONTAINER_MODE) {
  startAndProxyToHubContainer = require('./start-hub-container');
} else {
 BroccoliConnector = require('./broccoli-connector');
 Funnel = require('broccoli-funnel');
}

// TODO: move into configuration
const defaultBranch = 'master';

let addon = {
  name: '@cardstack/hub',

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
    if (!CONTAINER_MODE) {
      this._broccoliConnector = new BroccoliConnector();
    }
  },

  included(app){
    while (app.app) {
      app = app.app;
    }
    let env = app.env;
    this._super.apply(this, arguments);
    if (!this._active){ return; }

    if (!CONTAINER_MODE) {
      app.import('vendor/cardstack/generated.js');
    }

    if (!process.env.ELASTICSEARCH_PREFIX) {
      process.env.ELASTICSEARCH_PREFIX = this.project.pkg.name.replace(/^[^a-zA-Z]*/, '').replace(/[^a-zA-Z0-9]/g, '_') + '_' + env;
    }

    // start spinning up the hub immediately, because our treeFor*
    // hooks won't resolve until the hub does its first codegen build,
    // and the middleware hooks won't run until after that.

    if (CONTAINER_MODE) {
      this._hubProxy = startAndProxyToHubContainer(this.project.root);
    } else {
      let seedPath = path.join(path.dirname(this.project.configPath()), '..', 'cardstack', 'seeds', env);
      let useDevDeps;
      if (env === 'test') {
        useDevDeps = true;
      } else {
        // if the hub is a runtime dependency, it should only load other
        // plugins that are also runtime dependencies. If it's a
        // devDependency, it will also load other plugins that are
        // devDependencies.
        let { pkg } = this.project;
        useDevDeps = !(pkg.dependencies && pkg.dependencies['@cardstack/hub']);
      }

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

    if (CONTAINER_MODE) {
      // FIXME: this prevents shutdown while it's pending, even in response to a user SIGINT
      app.use('/cardstack', await this._hubProxy);
    } else {
      app.use('/cardstack', await this._hubMiddleware);
    }
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
  }
};

if (!CONTAINER_MODE) {
  addon.buildError = function(error) {
    if (this._broccoliConnector) {
      this._broccoliConnector.buildFailed(error);
    }
  };

  addon.postBuild = function(results) {
    if (this._broccoliConnector) {
      this._broccoliConnector.buildSucceeded(results);
    }
  };

  addon.treeForVendor = function() {
    if (!this._active){
      this._super.apply(this, arguments);
      return;
    }

    return new Funnel(this._broccoliConnector.tree, {
      srcDir: defaultBranch,
      destDir: 'cardstack'
    });
  };

  addon._makeServer = async function(seedDir, ui, allowDevDependencies, env) {
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
  };
}

module.exports = addon;
