import Component from '@glimmer/component';
import { get } from 'lodash';

export default class CardInspector extends Component {
  get fields() {
    let fields = [];
    if (!this.args.card) { return fields; }

    let card = this.args.card;
    for (let fieldRef of get(card, 'data.relationships.fields.data') || []) {
      let field = (card.included || []).find(i => `${i.type}/${i.id}` === `${fieldRef.type}/${fieldRef.id}`);
      if (!field) { continue; }

      let [, , , fieldName] = fieldRef.id.split('::');
      let { attributes:fieldSchema } = field;
      let fieldValue = this.modelFields[fieldName];

      fields.push({
        fieldName,
        fieldSchema,
        fieldValue
      });
    }

    return fields;
  }

  get modelFields() {
    let card = this.args.card;
    let result = {};
    if (!card) { return result; }

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