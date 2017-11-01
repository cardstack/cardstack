const path = require('path');
const fs = require('fs');
const http = require('http');
const {promisify} = require('util');
const writeFile = promisify(fs.writeFile);

const chalk = require('chalk');
const quickTemp = require('quick-temp');
const Plugin = require('broccoli-plugin');
const {WatchedDir} = require('broccoli-source');

class CodeWriter extends Plugin {
  constructor(branch, trigger) {
    super([trigger], { name: '@cardstack/hub', needsCache: false });

    this.branch = branch;
  }

  async build() {
    let filePath = path.join(this.outputPath, 'cardstack-generated.js');

    return new Promise(function(resolve, reject) {
      let url = 'http://localhost:3000/codegen/master';

      let request = http.get(url, function(response) {
          if (response.statusCode < 300) { // good response

            let output = fs.createWriteStream(filePath);
            response.pipe(output);
            response.on('end', resolve);

          } else { // error response
            let body = [];
            response.on('data', (chunk) => body.push(chunk));
            response.on('end', function() {

              let msg =
chalk`
{bold.red Invalid response for generated code from Cardstack Hub. Please resolve the issue, and try again}
{yellow GET ${url}: ${response.statusCode} ${response.statusMessage}}
{yellow ${body.join('')}}
`.trim();

              let err = new Error();
              err.stack = msg;
              reject(err);
              // This doesn't actually exit the process! Ember-cli traps this thing and waits for the broccoli
              // build to finish.
              process.exit();
            });
          }
      });

      request.on('error', function() { // no response
        let err = new Error();
        err.stack = chalk.red.bold("Couldn't reach Cardstack Hub. Please make sure it's running, with `ember hub:start`");
        reject(err);
        // This doesn't actually exit the process! Ember-cli traps this thing and waits for the broccoli
        // build to finish.
        process.exit();
      });
    });
  }
}

module.exports = class BroccoliConnector {
  constructor(branch) {
    quickTemp.makeOrRemake(this, '_triggerDir', 'cardstack-hub');
    this._trigger = new WatchedDir(this._triggerDir, { annotation: '@cardstack/hub' });
    this.tree = new CodeWriter(branch, this._trigger);
    this._buildCounter = 0;
  }
  triggerRebuild() {
    let triggerPath = path.join(this._triggerDir, 'cardstack-build');
    writeFile(triggerPath, String(this._buildCounter++), 'utf8');
  }
};
