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

class GithubAuthCodeGenerator {

  async generateModules() {
    let activeSources = await this.sources.active();
    let source = Array.from(activeSources.values()).find(s => s.sourceType === '@cardstack/github-auth');
    if (!source || !source.authenticator) { 
      return new Map(); 
    } else {
      let { clientId } = source.authenticator;
      let compiled = template({
        properties: [{
          name: 'clientId',
          value: clientId,
        }]
      });
      return new Map([['environment', compiled]]);
    }
  }
});
