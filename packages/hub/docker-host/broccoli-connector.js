const path = require('path');
const fs = require('fs');
const request = require('superagent');
const {promisify} = require('util');
const writeFile = promisify(fs.writeFile);

const chalk = require('chalk');
const quickTemp = require('quick-temp');
const Plugin = require('broccoli-plugin');
const {WatchedDir} = require('broccoli-source');

class CodeWriter extends Plugin {
  constructor(codeGenUrlPromise, trigger) {
    super([trigger], { name: '@cardstack/hub', needsCache: false });

    this.codeGenUrlPromise = codeGenUrlPromise;
  }

  async build() {
    let filePath = path.join(this.outputPath, 'cardstack-generated.js');
    let url = await this.codeGenUrlPromise;
    if (!url) {
      fs.writeFileSync(filePath, '', 'utf8');
      return;
    }

    try {
      let response = await request.get(url).buffer(true);
      await writeFile(filePath, response.text, );
    }
    catch(err) { // superagent will throw for all non-success status codes as well as for lower level network errors
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
  constructor(codeGenUrl) {
    quickTemp.makeOrRemake(this, '_triggerDir', 'cardstack-hub');
    this._trigger = new WatchedDir(this._triggerDir, { annotation: '@cardstack/hub' });
    this.tree = new CodeWriter(codeGenUrl, this._trigger);
    this._buildCounter = 0;
  }
  triggerRebuild() {
    let triggerPath = path.join(this._triggerDir, 'cardstack-build');
    writeFile(triggerPath, String(this._buildCounter++), 'utf8');
  }
};
