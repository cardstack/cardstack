const { declareInjections } = require('@cardstack/di');
const Handlebars = require('handlebars');

Handlebars.registerHelper('camelize', function(str) {
  return str.replace(/-(\w)/g, (m, d) => d.toUpperCase());
});

const modelTemplate = Handlebars.compile(`
import BaseModel from '@cardstack/models/model';
import DS from 'ember-data';
export default BaseModel.extend({
  {{#each fields as |field|}}
    {{#if field.isRelationship}}
      // relationship {{field.id}}
    {{else}}
      {{camelize field.id}}: DS.attr({ fieldType: "{{field.fieldType}}"}),
    {{/if}}
  {{/each}}
});

`);

module.exports = declareInjections({
  schemaCache: 'hub:schema-cache'
},

class CodeGenerator {
  async generateCode(appModulePrefix, branch) {
    let schema = await this.schemaCache.schemaForBranch(branch);
    let modules = new Map();

    for (let type of schema.types.values()) {
      // TODO: real inflector
      let modelName = type.id.replace(/s$/, '');

      modules.set(`addon/models/${modelName}`, this._generatedModel(type));

      modules.set(
        `app/models/${modelName}`,
        this._reexport(`@cardstack/hub/models/${modelName}`)
      );

      modules.set(
        `app/adapters/${modelName}`,
        this._reexport(`@cardstack/models/adapter`)
      );

      modules.set(
        `app/serializers/${modelName}`,
        this._reexport(`@cardstack/models/serializer`)
      );
    }
    return modules;
  }
  _generatedModel(type) {
    return modelTemplate({
      fields: [...type.fields.values()].filter(f => f.id !== 'id' && f.id !== 'type')
    });
  }
  _reexport(module) {
    return `export { default } from '${module}';`;
  }
});
