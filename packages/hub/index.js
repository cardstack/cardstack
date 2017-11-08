const log = require('@cardstack/plugin-utils/logger')('hub/ember-cli');
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

  included(){
    this._super.apply(this, arguments);
    if (!this._active){ return; }
    this.import('vendor/cardstack-generated.js');
    this._env = process.env.EMBER_ENV || 'development';
    this._hub = this._startHub();
    this._modulePrefix = require(this.project.configPath())(this._env).modulePrefix;
  },

  async _startHub() {
    if (process.env.HUB_URL) {
      // we were given an existing hub url to talk to, so don't start a hub
      return process.env.HUB_URL;
    }
    if (CONTAINER_MODE) {
      throw new Error("TODO: automatically start containerized hub here. This code should block until the hub is actually listening, and it should return the URL at which the hub is listening.");
    } else {
      // we wait until here to require this because in the
      // containerized case, "main" and its recursive dependencies
      // never need to load on the host environment.
      let { spawnHub } = require('./main');
      return spawnHub(this.project.pkg.name, this.project.configPath(), this._env);
    }
  },

  // The serverMiddleware hook is well-behaved and will wait for us to
  // resolve a promise before moving on.
  async serverMiddleware({ app }) {
    if (!this._active){
      this._super.apply(this, arguments);
      return;
    }

    let url = await this._hub;
    app.use('/cardstack', proxyToHub(url));
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
    let queue = [];
    this._hub.then(
      url => {
        handler = proxyToHub(url);
        for (let { req, res } of queue) {
          handler(req, res);
        }
      },
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
        queue.push({ req, res });
      }
    });
  },

  treeForVendor() {
    if (!this._active){
      this._super.apply(this, arguments);
      return;
    }
    return new NewBroccoliConnector(`http://localhost:3000/codegen/${defaultBranch}/${this._modulePrefix}`).tree;
  }

};
module.exports = addon;
