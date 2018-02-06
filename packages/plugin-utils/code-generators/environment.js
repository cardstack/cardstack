const Handlebars = require('handlebars');
const template = Handlebars.compile(`
define("@cardstack/plugin-utils/environment", ["exports"], function (exports) {
  "use strict";
  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  {{#each properties as |property|}}
    exports.{{property.name}} = "{{property.value}}";
  {{/each}}
});
`);

module.exports = class {
  static create() {
    return new this();
  }
  async generateCode(appModulePrefix, branch) {
    let env = Object.assign(this._content(), { appModulePrefix, branch });
    return template({ properties: Object.entries(env).map(([name, value]) => ({ name, value })) });
  }
  _content() {
    return {
      defaultBranch: 'master',
      hubURL: 'http://localhost:3000',
      compiledAt: new Date().toISOString()
    };
  }
};
