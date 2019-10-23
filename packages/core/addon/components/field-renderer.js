import Component from '@glimmer/component';
import { dasherize } from '@ember/string';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

// TODO This will be part of the official API. Move this into core as it solidifies
export default class FieldRenderer extends Component {
  @tracked newFieldName;
  @tracked currentNonce;

  constructor(...args) {
    super(...args);

    this.newFieldName = this.args.field.name;
    this.currentNonce = this.args.field.nonce;
  }

  get sanitizedType() {
    return this.args.field.type.replace(/::/g, '/').replace(/@/g, '');
  }

  get onFieldUpdated() {
    if (this.args.field.nonce !== this.currentNonce) {
      this.currentNonce = this.args.field.nonce;
      this.newFieldName = this.args.field.name;
    }
    return null;
  }

  get dasherizedType() {
    return dasherize(this.sanitizedType.replace(/\//g, '-'));
  }

  get fieldViewer() {
    return `fields/${dasherize(this.sanitizedType)}-viewer`;
  }

  get fieldEditor() {
    return `fields/${dasherize(this.sanitizedType)}-editor`;
  }

  @action
  updateFieldName(newName) {
    this.newFieldName = newName;
    this.args.setFieldName(this.args.field.name, this.newFieldName);
  }

  @action
  selectField(field) {
    if (this.args.selectField) {
      this.args.selectField(field);
    }
  }
}