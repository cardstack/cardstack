const Plugin = require('broccoli-plugin');
const symlinkOrCopy = require('symlink-or-copy').sync;
const path = require('path');
const fs = require('fs');

module.exports = class ConditionalInclude extends Plugin {
  constructor(inputTree, { name, predicate }) {
    super([inputTree], { name: `conditional-include/${name}`, persistentOutput: false, needsCache: false });
    this.predicate = predicate;
  }

  async build() {
    let enabled = await this.predicate();
    if (enabled) {
      for (let file of fs.readdirSync(this.inputPaths[0])) {
        symlinkOrCopy(path.join(this.inputPaths[0], file), path.join(this.outputPath, file));
      }
    }
  }
};
