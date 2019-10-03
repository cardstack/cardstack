import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';


export default class FieldCreator extends Component {
  @tracked newFieldType = 'string';
  @tracked newFieldName;
  @tracked newFieldEmbedded;
  @tracked newFieldValue;
  @tracked newFieldPosition;

  constructor(...args) {
    super(...args);
    this.resetAddField();
  }

  get fieldTypes() {
    return Object.keys(this.args.fieldTypeMappings);
  }

  resetAddField() {
    this.newFieldType = 'string';
    this.newFieldValue = null;
    this.newFieldEmbedded = false;
    this.newFieldName = null;
    this.newFieldPosition = this.args.numFields;
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

    this.resetAddField();
  }
}