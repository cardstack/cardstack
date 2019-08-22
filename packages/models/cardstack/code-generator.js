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
import Model from '@cardstack/models/model';
import DS from 'ember-data';

export default Model.extend({
  type: "{{modelName}}",
  selfLink: DS.attr(),
  {{#each fields as |field|}}
    {{#if field.isRelationship}}
      {{#with (related-type field ../modelName) as |type|}}
        {{camelize field.id}}:  DS.{{relationship-method field}}("{{type}}", {
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
      {{camelize field.id}}: DS.attr({
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
`);

const reexportTemplate = Handlebars.compile(`
export { default } from "{{source}}";
`);

module.exports = declareInjections({
  currentSchema: 'hub:current-schema'
},

class CodeGenerator {

  async generateAppModules() {
    let schema = await this.currentSchema.getSchema();
    let modules = new Map();

    for (let type of schema.getTypes().values()) {
      let modelName = inflection.singularize(type.id);
      modules.set(`models/${modelName}`, reexportTemplate({ source: `@cardstack/models/generated/${modelName}` }));
      modules.set(`adapters/${modelName}`,reexportTemplate({ source: `@cardstack/models/adapter`}));
      modules.set(`serializers/${modelName}`, reexportTemplate({ source: `@cardstack/models/serializer` }));
    }

    // define an adapter for the cardstack-card base type as well to allow for polymorphic queries
    modules.set(`adapters/cardstack-card`, reexportTemplate({ source: `@cardstack/models/adapter` }));

    return modules;
  }

  async generateModules() {
    let schema = await this.currentSchema.getSchema();
    let modules = new Map();

    for (let type of schema.getTypes().values()) {
      let modelName = inflection.singularize(type.id);
      modules.set(`generated/${modelName}`, this._generatedModel(modelName, type));
    }
    return modules;
  }

  _generatedModel(modelName, type) {
    return modelTemplate({
      modelName,
      fields: [...type.realAndComputedFields.values()].filter(f => f.id !== 'id' && f.id !== 'type'),
      routingField: type.routingField
    });
  }
});
