const { declareInjections } = require('@cardstack/di');
const Handlebars = require('handlebars');

Handlebars.registerHelper('camelize', function(str) {
  return str.replace(/-(\w)/g, (m, d) => d.toUpperCase());
});

const modelTemplate = Handlebars.compile(`
define('@cardstack/models/generated/{{modelName}}', ['exports', '@cardstack/models/model', 'ember-data'], function (exports, _model, _emberData) {
  'use strict';
   Object.defineProperty(exports, "__esModule", {
     value: true
   });
   exports.default = _model.default.extend({
     {{#each fields as |field|}}
       {{#if field.isRelationship}}
         // relationship {{field.id}}
       {{else}}
        {{camelize field.id}}: _emberData.default.attr({ fieldType: "{{field.fieldType}}"}),
       {{/if}}
     {{/each}}
   });
});
`);

const reexportTemplate = Handlebars.compile(`
define('{{target}}', ['exports', '{{source}}'], function (exports, _source) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  Object.defineProperty(exports, 'default', {
    enumerable: true,
    get: function () {
      return _source.default;
    }
  });
});
`);

module.exports = declareInjections({
  schemaCache: 'hub:schema-cache'
},

class CodeGenerator {
  async generateCode(appModulePrefix, branch) {
    let schema = await this.schemaCache.schemaForBranch(branch);
    let modules = [];

    for (let type of schema.types.values()) {
      // TODO: real inflector
      let modelName = type.id.replace(/s$/, '');

      modules.push(this._generatedModel(modelName, type));

      modules.push(
        reexportTemplate({ target: `${appModulePrefix}/models/${modelName}`, source: `@cardstack/models/generated/${modelName}` })
      );

      modules.push(
        reexportTemplate({ target: `${appModulePrefix}/adapters/${modelName}`, source: `@cardstack/models/adapter` })
      );

      modules.push(
        reexportTemplate({ target: `${appModulePrefix}/serializers/${modelName}`, source: `@cardstack/models/serializer` })
      );
    }
    return modules.join("");
  }
  _generatedModel(modelName, type) {
    return modelTemplate({
      modelName,
      fields: [...type.fields.values()].filter(f => f.id !== 'id' && f.id !== 'type')
    });
  }
});
