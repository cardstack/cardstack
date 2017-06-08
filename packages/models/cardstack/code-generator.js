const { declareInjections } = require('@cardstack/di');
const fs = require('fs');
const denodeify = require('denodeify');
const writeFile = denodeify(fs.writeFile);
const path = require('path');
const mkdirp = denodeify(require('mkdirp'));
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
  async generateCode(branch, outDirectory) {
    let schema = await this.schemaCache.schemaForBranch(branch);
    await mkdirp(path.join(outDirectory, 'addon', 'models'));
    await mkdirp(path.join(outDirectory, 'app', 'models'));
    await mkdirp(path.join(outDirectory, 'app', 'adapters'));
    await mkdirp(path.join(outDirectory, 'app', 'serializers'));

    for (let type of schema.types.values()) {

      // TODO: real inflector
      let modelName = type.id.replace(/s$/, '');

      await writeFile(
        path.join(outDirectory, 'addon', 'models', `${modelName}.js`),
        this._generatedModel(type),
        'utf8'
      );
      await writeFile(
        path.join(outDirectory, 'app', 'models', `${modelName}.js`),
        this._reexport(`@cardstack/hub/models/${modelName}`),
        'utf8'
      );
      await writeFile(
        path.join(outDirectory, 'app', 'adapters', `${modelName}.js`),
        this._reexport(`@cardstack/models/adapter`),
        'utf8'
      );
      await writeFile(
        path.join(outDirectory, 'app', 'serializers', `${modelName}.js`),
        this._reexport(`@cardstack/models/serializer`),
        'utf8'
      );
    }
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
