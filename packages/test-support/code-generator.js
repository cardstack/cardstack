const { URL } = require('url');
const Handlebars = require('handlebars');
const { declareInjections } = require('@cardstack/di');

const template = Handlebars.compile(`
define("@cardstack/test-support/environment", ["exports"], function (exports) {
  "use strict";
  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  {{#each properties as |property|}}
    exports.{{property.name}} = "{{property.value}}";
  {{/each}}
});
`);

module.exports = declareInjections({
  ciSessionId: 'config:ci-session'
},

class LiveQueryCodeGenerator {

  async generateCode() {
    let value = this.ciSessionId && this.ciSessionId.id;

    return value ? template({ properties: [
      {
        name: 'ciSessionId',
        value
      }
    ]}) : null;
  }
});
