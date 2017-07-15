const Handlebars = require('handlebars');
const template = Handlebars.compile(`export const {{key}} = "{{value}}";`);

module.exports = class {
  static create() {
    return new this();
  }
  async generateCode(appModulePrefix, branch) {
    let modules = new Map();
    let env = Object.assign(this._content(), { appModulePrefix, branch });
    modules.set('addon/environment', Object.entries(env).map(([key, value]) => template({ key, value })).join("\n"));
    return modules;
  }
  _content() {
    // TODO: make these dynamic
    return {
      defaultBranch: 'master',
      hubURL: '/cardstack',
      compiledAt: new Date().toISOString()
    };
  }
};
