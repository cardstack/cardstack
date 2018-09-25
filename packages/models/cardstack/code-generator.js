const { declareInjections } = require('@cardstack/di');
const Handlebars = require('handlebars');
const inflection = require('inflection');

Handlebars.registerHelper('camelize', function(str) {
  return str.replace(/-(\w)/g, (m, d) => d.toUpperCase());
});

Handlebars.registerHelper('relationship-method', function(field) {
  if (field.fieldType === '@cardstack/core-types::has-many') {
    return 'hasMany';
  } else {
    return 'belongsTo';
  }
});

Handlebars.registerHelper('related-type', function(field, modelName) {
  if (field.relatedTypes) {
    let type = Object.keys(field.relatedTypes)[0];
    if (type) {
      return inflection.singularize(type);
    }
  }
  // we default to our own type. This is weird, but it turns out that for most
  // of the operations we care about, Ember Data doesn't really care what type
  // we put here so long as its a valid type that exists.
  return modelName;
});

Handlebars.registerHelper('json', function(obj) {
  obj = obj || {};
  return JSON.stringify(obj);
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
         {{#with (related-type field ../modelName) as |type|}}
           {{camelize field.id}}:  _emberData.default.{{relationship-method field}}("{{type}}", {
             async: false,
             inverse: null,
             caption: "{{field.caption}}",
             editorComponent: "{{field.editorComponent}}",
             inlineEditorComponent: "{{field.inlineEditorComponent}}",
             editorOptions: {{{json field.editorOptions}}},
             inlineEditorOptions: {{{json field.inlineEditorOptions}}},
             owned: {{field.owned}}
            }),
          {{/with}}
        {{else}}
          {{camelize field.id}}: _emberData.default.attr({
            fieldType: "{{field.fieldType}}",
            caption: "{{field.caption}}",
            editorComponent: "{{field.editorComponent}}",
            inlineEditorComponent: "{{field.inlineEditorComponent}}",
            editorOptions: {{{json field.editorOptions}}},
            inlineEditorOptions: {{{json field.inlineEditorOptions}}}
          }),
       {{/if}}
     {{/each}}
   }){{#if routingField}}.reopenClass({ routingField: "{{routingField}}" }){{/if}};
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
  schema: 'hub:current-schema'
},

class CodeGenerator {
  async generateCode(appModulePrefix, branch) {
    let schema = await this.schema.forBranch(branch);
    let modules = [];

    for (let type of schema.types.values()) {
      let modelName = inflection.singularize(type.id);

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
      fields: [...type.realAndComputedFields.values()].filter(f => f.id !== 'id' && f.id !== 'type'),
      routingField: type.routingField
    });
  }
});
