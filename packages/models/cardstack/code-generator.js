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

Handlebars.registerHelper('related-type', function(field) {
  if (field.relatedTypes) {
    let type = Object.keys(field.relatedTypes)[0];
    if (type) {
      return inflection.singularize(type);
    }
  }
  // default to cardstack-card to allow for polymorphic relationship updates
  return 'cardstack-card';
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
     type: "{{modelName}}",
     selfLink: _emberData.default.attr(),
     {{#each fields as |field|}}
       {{#if field.isRelationship}}
         {{#with (related-type field ../modelName) as |type|}}
           {{camelize field.id}}:  _emberData.default.{{relationship-method field}}("{{type}}", {
             async: false,
             polymorphic: true,
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
  schema: 'hub:current-schema',
  searchers: 'hub:searchers',
},

class CodeGenerator {
  async generateCode(appModulePrefix, branch, session) {
    let schema = await this.schema.forBranch(branch);
    let modules = [];

    for (let type of schema.types.values()) {
      let modelName = inflection.singularize(type.id);

      modules.push(await this._generatedModel(modelName, type, branch, session));

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

    // define an adapter for the cardstack-card base type as well to allow for polymorphic queries
    modules.push(
      reexportTemplate({ target: `${appModulePrefix}/adapters/cardstack-card`, source: `@cardstack/models/adapter` })
    );

    return modules.join("");
  }
  async _generatedModel(modelName, type, branch, session) {
    let fields;
    let response;
    try {
      response = await this.searchers.get(session, branch, 'content-types', type.id);
    } catch(error) {
      if (error.isCardstackError) {
        return;
      }
      throw error;
    }
    let relationships = response.data.relationships;
    if (!relationships) {
      fields = [];
    } else {
      let { data: fieldsData } = relationships.fields;
      let readableFieldIds = fieldsData.map((fd) => fd.id);
      fields = [...type.realAndComputedFields.values()].filter((f) => {
        return f.id !== 'id' && f.id !== 'type' && readableFieldIds.includes(f.id);
      });
    }
    return modelTemplate({
      modelName,
      fields,
      routingField: type.routingField
    });
  }
});
