const Handlebars = require('handlebars');
const { declareInjections } = require('@cardstack/di');

const template = Handlebars.compile(`
define("@cardstack/github-auth/environment", ["exports"], function (exports) {
  "use strict";
  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  {{#each properties as |property|}}
    exports.{{property.name}} = "{{property.value}}";
  {{/each}}
});
`);

module.exports = declareInjections(
  {
    sources: 'hub:data-sources',
  },

  class GithubAuthCodeGenerator {
    async generateCode() {
      let activeSources = await this.sources.active();
      let source = Array.from(activeSources.values()).find(s => s.sourceType === '@cardstack/github-auth');
      if (!source || !source.authenticator) {
        return;
      }

      let { clientId } = source.authenticator;

      return template({
        properties: [
          {
            name: 'clientId',
            value: clientId,
          },
        ],
      });
    }
  },
);
