const quickTemp = require('quick-temp');
const { WatchedDir } = require('broccoli-source');
const Plugin = require('broccoli-plugin');
const fs = require('fs');
const denodeify = require('denodeify');
const path = require('path');
const readFile = denodeify(fs.readFile);
const writeFile = denodeify(fs.writeFile);
const mkdirp = denodeify(require('mkdirp'));

class CodeWriter extends Plugin {
  constructor(trigger, codeGenerators) {
    super([trigger], { name: '@cardstack/hub', needsCache: false });
    this.codeGenerators = codeGenerators;
  }

  async build() {
    let generators = await this.codeGenerators;
    let modulesByBranch = await generators.generateCode();
    await this._writeModules(modulesByBranch);
    let cardstackBuild;
    try {
      cardstackBuild = await readFile(path.join(this.inputPaths[0], 'cardstack-build'));
    } catch (err) {
      // it's ok if the cardstack-build file doesn't exist, that just
      // means that we haven't triggered any builds yet
      cardstackBuild = '-1';
    }
    await writeFile(this.outputPath + '/.cardstack-build', cardstackBuild);
  }

  async _writeModules(modulesByBranch) {
    for (let [branch, modules] of modulesByBranch.entries()) {
      for (let [modulePath, code] of modules.entries()) {
        let diskPath = path.join(this.outputPath, branch, path.dirname(modulePath));
        await mkdirp(diskPath);
        await writeFile(path.join(diskPath, path.basename(modulePath) + '.js'), code);
      }
    }
  }
}

module.exports = class BroccoliConnector {
  constructor() {
    quickTemp.makeOrRemake(this, '_triggerDir', 'cardstack-hub');
    this._trigger = new WatchedDir(this._triggerDir, { annotation: '@cardstack/hub' });
    this._codeGenerators = new Promise(resolve => { this.setSource = resolve; });
    this.tree = new CodeWriter(this._trigger, this._codeGenerators);
    this._pendingBuilds = [];
    this._buildCounter = 0;
  }
  triggerRebuild() {
    return new Promise((resolve, reject) => {
      let nonce = this._buildCounter++;
      this._pendingBuilds.push({ nonce, resolve, reject });
      writeFile(this._triggerDir + '/cardstack-build', String(nonce), 'utf8');
    });
  }
  async buildSucceeded({ directory }) {
    let nonce;
    try {
      nonce = parseInt(await readFile(path.join(directory, '.cardstack-build'), 'utf8'));
    } catch (err) {
      nonce = -1;
    }
    let remaining = [];
    for (let build of this._pendingBuilds) {
      if (build.nonce <= nonce) {
        build.resolve();
      } else {
        remaining.push(build);
      }
    }
    this._pendingBuilds = remaining;
  }
  buildFailed() {
    for (let build of this._pendingBuilds) {
      build.reject();
    }
    this._pendingBuilds = [];
  }
};
