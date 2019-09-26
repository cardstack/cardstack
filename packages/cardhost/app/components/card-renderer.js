import Component from '@glimmer/component';
import { get } from 'lodash';

export default class CardRenderer extends Component {
  // TODO use Card class data service to get fields
  get fields() {
    let fields = [];
    if (!this.args.card) { return fields; }

    let card = this.args.card.isolatedData;
    for (let fieldRef of get(card, 'data.relationships.fields.data') || []) {
      let field = (card.included || []).find(i => `${i.type}/${i.id}` === `${fieldRef.type}/${fieldRef.id}`);
      if (!field) { continue; }

      let fieldName = fieldRef.id;
      let { attributes:fieldSchema } = field;
      let fieldValue = this.modelFields[fieldName];
      let { 'field-type': fieldType } = fieldSchema || {};

      fields.push({
        fieldName,
        fieldType,
        fieldSchema,
        fieldValue
      });
    }
    return fields;
  }

  // TODO use Card class data service to get fields
  get modelFields() {
    let result = {};
    if (!this.args.card) { return result; }
    let card = this.args.card.isolatedData;

    let model = (card.included || []).find(i => `${i.type}/${i.id}` === `${card.data.id}/${card.data.id}`);
    let modelFields = model ? model.attributes : {};
    for (let field of Object.keys(modelFields || {})) {
      let value = modelFields[field];
      if (typeof value === 'object') {
        value = JSON.stringify(value, null, 2);
      }
      result[field] = value;
    }

    modelFields = model ? model.relationships : {};
    for (let field of Object.keys(modelFields || {})) {
      result[field] = JSON.stringify(modelFields[field].data, null, 2);
    }
    return result;
  }
}