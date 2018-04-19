const Field = require('./field');

module.exports = class ComputedField {
  constructor(model, plugins, allGrants, allFields, allComputedFields) {
    if (!model.attributes || !model.attributes['computed-field-type']) {
      throw new Error(`computed-field ${model.id} has no computed-field-type attribute`);
    }

    let fieldType = model.attributes['computed-field-type'];
    let { type, compute } = plugins.lookupFeatureFactoryAndAssert('computed-field-types', fieldType).class;

    this._virtualField = null;
    this.compute = compute;
    this.params = model.attributes.params || {};

    this._finishSetup = () => {
      if (typeof type === 'function') {
        type = type({
          typeOf(otherFieldId)  {
            let otherField = allFields.get(otherFieldId);
            if (otherField) {
              return otherField.fieldType;
            }
            otherField = allComputedFields.get(otherFieldId);
            if (otherField) {
              return otherField.virtualField.fieldType;
            }
            throw new Error(`computed field ${model.id} tries to base its type on the nonexistent field ${otherFieldId}`);
          }
        }, this.params);
      }

      let virtualModel = {
        id: model.id,
        type: 'fields',
        attributes: {
          'field-type': type,
          caption: model.attributes.caption,
          searchable: model.attributes.searchable
        }
      };
      this._virtualField = new Field(virtualModel, plugins, allGrants);
    };
  }

  get virtualField() {
    if (!this._virtualField) {
      this._finishSetup();
    }
    return this._virtualField;
  }
};
