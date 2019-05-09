const Ember = require('ember-source/dist/ember.debug');
const { camelize } = Ember.String;
const Handlebars = require('handlebars');
const { declareInjections } = require('@cardstack/di');

const template = Handlebars.compile(`
  {{#each properties as |property|}}
    export const {{property.name}} = "{{property.value}}";
  {{/each}}
`);

module.exports = declareInjections({
  sources: 'hub:data-sources',
},


class EthereumCodeGenerator {

  async generateModules() {
    let activeSources = await this.sources.active();
    let ethereumSources = [...activeSources.values()].filter(s => s.sourceType === '@cardstack/ethereum');
    if (!ethereumSources || !ethereumSources.length) { return; }

    let sourceConfigs = [];
    for (let source of ethereumSources) {
      if (source._params.contract) {
        let { id, _params: { contract: { address } } } = source;

        sourceConfigs.push({
          contract: id,
          address
        });
      }
    }

    if (sourceConfigs.length) {
      return new Map([['environment', template({
          properties: sourceConfigs.map(config => {
            return {
              name: camelize(config.contract + '-address'),
              value: config.address
            };
          })
        })
      ]]);
    } else {
      return new Map();
    }
  }
});

