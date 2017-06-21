const quickTemp = require('quick-temp');
const { WatchedDir } = require('broccoli-source');
const Plugin = require('broccoli-plugin');
const fs = require('fs');

class CodeWriter extends Plugin {
  constructor(trigger, codeGenerators) {
    super([trigger], { name: '@cardstack/hub', needsCache: false });
    this.codeGenerators = codeGenerators;
  }
  async build() {
    fs.mkdirSync(this.outputPath + '/app');
    fs.mkdirSync(this.outputPath + '/addon');
    let generators = await this.codeGenerators;
    await generators.generateCode(this.outputPath);
  }
}

module.exports = class BroccoliConnector {
  constructor() {
    quickTemp.makeOrRemake(this, '_triggerDir', 'cardstack-hub');
    this._trigger = new WatchedDir(this._triggerDir, { annotation: '@cardstack/hub' });
    this._codeGenerators = new Promise(resolve => { this.setSource = resolve; });
    this.tree = new CodeWriter(this._trigger, this._codeGenerators);
  }
  triggerRebuild() {
    fs.writeFileSync(this._triggerDir + '/forceRebuild', Math.random().toString(), 'utf8');
  }
};
