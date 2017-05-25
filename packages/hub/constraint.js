module.exports = class Constraint {
  static async create(model, plugins) {
    let plugin = await plugins.lookupFeatureAndAssert('constraints', model.attributes['constraint-type']);
    return new this(model, plugin);
  }

  constructor(model, plugin) {
    this.parameters = model.attributes.parameters;
    this.plugin = plugin;
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
