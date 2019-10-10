import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action, get } from '@ember/object';


export default class FieldCreator extends Component {
  @tracked newFieldType;
  @tracked newFieldName;
  @tracked newFieldEmbedded;
  @tracked newFieldValue;
  @tracked newFieldPosition;

  constructor(...args) {
    super(...args);
    this.newFieldType = get(this, 'args.field.type') || 'string';
    this.newFieldValue = null;
    this.newFieldEmbedded = false;
    this.newFieldName = null;
    this.newFieldPosition = this.args.numFields;
  }

  get fieldTypes() {
    return Object.keys(this.args.fieldTypeMappings);
  }

  @action
  fieldTypeChanged({ target: { value }}) {
    this.newFieldValue = value === 'boolean' ? false : null;
    this.newFieldName = null;
    this.newFieldType = value;
  }

  @action
  addField() {
    if (!this.args.addField) { return; }

    this.args.addField(
      this.newFieldType,
      this.newFieldName,
      this.newFieldEmbedded,
      this.newFieldValue,
      Math.min(this.newFieldPosition, this.args.numFields)
    );
  }
}