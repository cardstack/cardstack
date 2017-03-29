module.exports = class Constraint {
  constructor(model, plugins) {
    this.parameters = model.attributes.parameters;
    this.plugin = plugins.lookup('constraints', model.attributes['constraint-type']);
  }
  async validationErrors(value) {
    let errors = this.plugin.valid(value, this.parameters);
    if (!errors) {
      return [];
    } else if (!Array.isArray(errors)) {
      return [errors];
    } else {
      return errors;
    }
  }
};
