const CONTAINER_MODE = process.env.CONTAINERIZED_HUB != null;
const BroccoliConnector = require("./docker-host/broccoli-connector");
const path = require("path");
const fs = require("fs");
const Funnel = require('broccoli-funnel');

let addon = {
  name: "@cardstack/hub",

  includedCommands() {
    if (CONTAINER_MODE) {
      return {
        "hub:build": require("./commands/build"),
        "hub:start": require("./commands/start"),
        "hub:stop": require("./commands/stop"),
        "hub:prune": require("./commands/prune"),
      };
    } else {
      return {
        "hub:start": require("./commands/start-native"),
        "hub:seed": require("./commands/seed"),
      };
    }
  },

  init() {
    this._super.init && this._super.init.apply(this, arguments);

    // We don't want to boot the hub multiple times, even if it gets
    // included by multiple addons. So we do a bit of global
    // coordination here and only the first instance takes effect.
    if (global.__cardstack_hub_running_in_ember_cli) {
      if (global.__cardstack_hub_running_in_ember_cli.isLocatorDummy) {
        throw new Error(
          `A plugin tried to use @cardstack/plugin-utils/locate-hub too early. It's only allowed after ember addon's have finished 'init'`
        );
      }
      this._active = false;
      return;
    } else {
      global.__cardstack_hub_running_in_ember_cli = this;
      this._active = true;
    }
  },

  async url() {
    if (!this._hub) {
      this._env = process.env.EMBER_ENV || "development";
      if (
        fs.existsSync(
          path.join(
            path.dirname(this.project.configPath()),
            "..",
            "cardstack",
            "data-sources"
          )
        )
      ) {
        this._hub = this._startHub();
      } else {
        this._hub = Promise.resolve(null);
      }
    }
    let url = await this._hub;
    return url;
  },

  included() {
    this._super.apply(this, arguments);
    if (!this._active) {
      return;
    }
    this.url(); // kicks off the actual hub as needed
  },

  async _startHub() {
    if (process.env.HUB_URL) {
      // we were given an existing hub url to talk to, so don't start a hub
      return process.env.HUB_URL;
    }
    if (CONTAINER_MODE) {
      throw new Error(
        "TODO: automatically start containerized hub here. This code should block until the hub is actually listening, and it should return the URL at which the hub is listening."
      );
    } else {
      // we wait until here to require this because in the
      // containerized case, "main" and its recursive dependencies
      // never need to load on the host environment.
      let StartNative = require("./commands/start-native");
      return StartNative.spawnHub(
        this.project.pkg.name,
        this.project.configPath(),
        this._env,
        process.env.HUB_PORT || 3000
      );
    }
  },

  _broccoliConnector() {
    if (!this._cachedBroccoliConnector) {
      let codeGenUrlPromise = this._hub.then(url => {
        if (url) {
          return `${url}/codegen-modules`;
        }
      });
      this._cachedBroccoliConnector = new BroccoliConnector(codeGenUrlPromise);
    }
    return this._cachedBroccoliConnector;
  },

  treeForApp() {
    if (!this._active) {
      this._super.apply(this, arguments);
      return;
    }

    return this._super.call(this, new Funnel(this._broccoliConnector().tree, { srcDir: 'app', allowEmpty: true }));
  },

  treeForAddon() {
    if (!this._active) {
      this._super.apply(this, arguments);
      return;
    }

    let tree = new Funnel(this._broccoliConnector().tree, { srcDir: 'addon', allowEmpty: true });
    return this.preprocessJs(tree, '/', this.name, {
      registry: this.registry,
    });
  },
};
module.exports = addon;
