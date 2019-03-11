const Error = require('@cardstack/plugin-utils/error');
const Handlebars = require('handlebars');

module.exports = class Constraint {
  static async create(model, plugins, inputAssignments, allFields) {
    let plugin = await plugins.lookupFeatureAndAssert('constraint-types', model.attributes['constraint-type']);
    return new this(model, plugin, inputAssignments, allFields);
  }

  constructor(model, plugin, inputAssignments, allFields) {
    let constantInputs = Object.create(null);
    if (model.attributes && model.attributes.inputs) {
      for (let [key, value] of Object.entries(model.attributes.inputs)) {
        constantInputs[key] = { value, name: value, oldValue: value };
      }
    }
    this.constantInputs = constantInputs;

    let fieldInputs = Object.create(null);
    if (model.relationships &&
        model.relationships['input-assignments'] &&
        model.relationships['input-assignments'].data) {
      model.relationships['input-assignments'].data.forEach(({type, id}) => {
        if (type !== 'input-assignments') {
          throw new Error(`constraint "${model.id}"'s input-assignments relationship can only refer to type input-assignments (found "${type}")`);
        }
        let assignment = inputAssignments.get(id);
        if (!assignment) {
          throw new Error(`constraint "${model.id}" refers to missing input-assignment "${id}"`);
        }
        let inputName, fieldId;
        if (!assignment.attributes || !(inputName = assignment.attributes['input-name'])) {
          throw new Error(`input-assignment "${assignment.id}" has no input-name attribute`);
        }
        if (!assignment.relationships ||
            !assignment.relationships.field ||
            !assignment.relationships.field.data ||
            !(fieldId = assignment.relationships.field.data.id)) {
          throw new Error(`input-assignment "${assignment.id}" has no field`);
        }

        let field = allFields.get(fieldId);
        if (!field) {
          throw new Error(`input-assignment "${assignment.id}" refers to nonexistent field "${fieldId}"`);
        }
        fieldInputs[inputName] = field;
      });
    }
    this.fieldInputs = fieldInputs;
    this.plugin = plugin;
  }

  get template() {
    if (!this._template) {
      this._template = Handlebars.compile(this.plugin.description);
    }
    return this._template;
  }

  async validationErrors(pendingChange) {
    let inputs = Object.assign({}, this.constantInputs);
    for (let [inputName, field] of Object.entries(this.fieldInputs)) {
      inputs[inputName] = {
        name: field.caption || field.id,
        value: field.valueFrom(pendingChange, 'finalDocument'),
        oldValue: field.valueFrom(pendingChange, 'originalDocument')
      };
    }
    if (!await this.plugin.valid(inputs)) {
      let detail = this.template(inputs);
      return Object.values(this.fieldInputs).map(
        field => new Error(detail, {
          title: 'Validation error',
          status: 422,
          source: { pointer: field.pointer() }
        })
      );
    } else {
      return [];
    }
  }
};
