const Handlebars = require('handlebars');
const { declareInjections } = require('@cardstack/di');

const template = Handlebars.compile(`
{{#each properties as |property|}}
  export const {{property.name}} = "{{property.value}}";
{{/each}}
`);

module.exports = declareInjections({
  publicURL: 'config:public-url'
},

class {
  async generateModules() {
    return new Map([[
      '@cardstack/plugin-utils/environment', 
      template({ properties: Object.entries(this._content()).map(([name, value]) => ({ name, value })) }) 
    ]]);
  }
  _content() {
    return {
      hubURL: this.publicURL.url,
      compiledAt: new Date().toISOString()
    };
  }
});
