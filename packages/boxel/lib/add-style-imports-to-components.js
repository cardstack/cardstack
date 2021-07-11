'use strict';
/* eslint-disable @typescript-eslint/no-var-requires */

const Plugin = require('broccoli-plugin');
const walkSync = require('walk-sync');
const fs = require('fs');
const path = require('path');

class AddStyleImportsToComponents extends Plugin {
  build() {
    let entries = walkSync.entries(this.inputPaths[0]);
    for (let entry of entries) {
      if (entry.isDirectory()) {
        fs.mkdirSync(path.posix.join(this.outputPath, entry.relativePath));
        continue;
      }
      let fileContents = fs.readFileSync(entry.fullPath);
      if (
        path.extname(entry.relativePath) === '.js' &&
        this.hasColocatedStyle(entry, entries)
      ) {
        fileContents = this.styleImportExpression(entry) + '\n' + fileContents;
      }
      fs.writeFileSync(
        path.posix.join(this.outputPath, entry.relativePath),
        fileContents,
        { encoding: 'utf8' }
      );
    }
  }

  hasColocatedStyle(entry) {
    let cssRelativePath = this.colocatedCssRelativePath(entry);
    return fs.existsSync(path.posix.join(this.inputPaths[0], cssRelativePath));
  }

  styleImportExpression(entry) {
    let importPath = path.basename(this.colocatedCssRelativePath(entry));
    return `import './${importPath}';`;
  }

  colocatedCssRelativePath(jsEntry) {
    let parsedPath = path.parse(jsEntry.relativePath);
    return path.posix.join(parsedPath.dir, parsedPath.name) + '.css';
  }
}

module.exports = AddStyleImportsToComponents;
