const denodeify = require('denodeify');
const fs = require('fs');
const path = require('path');
const writeFile = denodeify(fs.writeFile);
const Handlebars = require('handlebars');

const template = Handlebars.compile(`
export const defaultBranch = "{{defaultBranch}}";
export const hubURL = "{{hubURL}}";
`);

module.exports = class {
  static create() {
    return new this();
  }
  async generateCode(branch, outDirectory) {
    let filename = path.join(outDirectory, 'addon', 'environment.js');
    await writeFile(filename, template(this._content()), 'utf8');
  }
  _content() {
    // TODO: make these dynamic
    return {
      defaultBranch: 'master',
      hubURL: '/cardstack'
    };
  }
};
