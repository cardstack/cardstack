const Ember = require('ember-source/dist/ember.debug');
const { camelize } = Ember.String;
const Handlebars = require('handlebars');
const { declareInjections } = require('@cardstack/di');

const defaultBranch = 'master';
const template = Handlebars.compile(`
define("@cardstack/ethereum/environment", ["exports"], function (exports) {
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
  sources: 'hub:data-sources',
},


class EthereumCodeGenerator {

  async generateCode() {
    let activeSources = await this.sources.active();
    let ethereumSources = [...activeSources.values()].filter(s => s.sourceType === '@cardstack/ethereum');
    if (!ethereumSources || !ethereumSources.length) { return; }

    let sourceConfigs = [];
    for (let source of ethereumSources) {
      if (source._params.contract) {
        let { id, _params: { contract: { addresses } } } = source;

        sourceConfigs.push({
          contract: id,
          address: addresses[defaultBranch]
        });
      }
    }

    if (sourceConfigs.length) {
      return template({
        properties: sourceConfigs.map(config => {
          return {
            name: camelize(config.contract + '-address'),
            value: config.address
          };
        })
      });
    }
  }
});

