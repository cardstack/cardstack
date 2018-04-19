const Field = require('./field');

module.exports = class ComputedField {
  constructor(model, plugins, allGrants) {
    if (!model.attributes || !model.attributes['computed-field-type']) {
      throw new Error(`computed-field ${model.id} has no computed-field-type attribute`);
    }
    let fieldType = model.attributes['computed-field-type'];
    let { type: realType, compute } = plugins.lookupFeatureFactoryAndAssert('computed-field-types', fieldType).class;
    let virtualModel = {
      id: model.id,
      type: 'fields',
      attributes: {
        'field-type': realType,
        caption: model.attributes.caption,
        searchable: model.attributes.searchable
      }
    };
    this.virtualField = new Field(virtualModel, plugins, allGrants);
    this.compute = compute;
  }
};
