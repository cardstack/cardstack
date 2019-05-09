const Handlebars = require('handlebars');
const { declareInjections } = require('@cardstack/di');

const template = Handlebars.compile(`
  {{#each properties as |property|}}
    export const {{property.name}} = "{{property.value}}";
  {{/each}}
`);

module.exports = declareInjections({
  ciSessionId: 'config:ci-session'
},

class LiveQueryCodeGenerator {
  generateModules() {
    const name = 'ciSessionId';
    let value = this.ciSessionId && this.ciSessionId.id;
    if (value) {
      let compiled = template({
        properties: [{
          name,
          value
        }]
      });
      return new Map([['environment', compiled]]);
    } else {
      return new Map();
    }
  }
});


