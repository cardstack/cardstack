const Handlebars = require('handlebars');
const template = Handlebars.compile(`
export const defaultBranch = "{{defaultBranch}}";
export const hubURL = "{{hubURL}}";
`);

module.exports = class {
  static create() {
    return new this();
  }
  async generateCode(/* branch */) {
    let modules = new Map();
    modules.set('addon/environment.js', template(this._content()));
    return modules;
  }
  _content() {
    // TODO: make these dynamic
    return {
      defaultBranch: 'master',
      hubURL: '/cardstack'
    };
  }
};
