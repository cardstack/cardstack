const { join, dirname } = require("path");
const { writeFileSync, ensureDirSync } = require("fs-extra");
const request = require("superagent");

const chalk = require("chalk");
const quickTemp = require("quick-temp");
const Plugin = require("broccoli-plugin");
const { WatchedDir } = require("broccoli-source");

class CodeWriter extends Plugin {
  constructor(codeGenUrlPromise, appModulePrefix, trigger) {
    super([trigger], { name: "@cardstack/hub", needsCache: false });
    this.codeGenUrlPromise = codeGenUrlPromise;
    this.appModulePrefix = appModulePrefix;
  }

  async build() {
    let url = await this.codeGenUrlPromise;
    if (!url) {
      return;
    }

    try {
      let response = (await request.get(url).buffer(true)).body;
      for (let [name, source] of response.modules) {
        let target = join(this.outputPath, name + ".js");
        ensureDirSync(dirname(target));
        writeFileSync(target, source);
      }
      for (let [name, source] of response.appModules) {
        let target = join(this.outputPath, this.appModulePrefix, name + ".js");
        ensureDirSync(dirname(target));
        writeFileSync(target, source);
      }
    } catch (err) {
      // superagent will throw for all non-success status codes as well as for lower level network errors
      let msg;
      if (err.response) {
        msg = chalk`
{bold.red Invalid response for generated code from Cardstack Hub. Please resolve the issue, and try again}
{yellow GET ${url}: ${err.response.status}}
{yellow ${err.response.text}}
`.trim();
      } else {
        msg = chalk`
{bold.red Unable to contact Cardstack Hub to generate code. Please resolve the issue, and try again}
{yellow GET ${url}: ${err}}
`.trim();
      }
      throw new Error(msg);
    }
  }
}

module.exports = class BroccoliConnector {
  constructor(codeGenUrl, appModulePrefix) {
    quickTemp.makeOrRemake(this, "_triggerDir", "cardstack-hub");
    this._trigger = new WatchedDir(this._triggerDir, {
      annotation: "@cardstack/hub",
    });
    this.tree = new CodeWriter(codeGenUrl, appModulePrefix, this._trigger);
    this._buildCounter = 0;
  }
  triggerRebuild() {
    let triggerPath = join(this._triggerDir, "cardstack-build");
    writeFileSync(triggerPath, String(this._buildCounter++), "utf8");
  }
};
