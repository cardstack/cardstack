import Component from '@glimmer/component';
import { dasherize } from '@ember/string';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { fieldComponents } from '../utils/mappings';

const defaultSchemaAttrs = ['title', 'type', 'is-meta', 'name', 'instructions', 'embedded'];

// These are the field attributes that will trigger onFieldChanged()
// to be called when the values of this attributes change
const onFieldChangedDependencies = ['nonce', 'name', 'label', 'instructions'];

let renderNonce = 0;
export default class FieldRenderer extends Component {
  @tracked newFieldName;
  @tracked newFieldLabel;
  @tracked newFieldInstructions;
  @tracked currentNonce;
  @tracked renderNonce;

  constructor(...args) {
    super(...args);

    this.newFieldName = this.args.field.name;
    this.newFieldLabel = this.args.field.label;
    this.newFieldInstructions = this.args.field.instructions;
    this.currentNonce = this.nonce;
    this.renderNonce = renderNonce++;
  }

  get schemaAttrs() {
    return this.args.schemaAttrs || defaultSchemaAttrs;
  }

  get sanitizedType() {
    return this.args.field.type.replace(/::/g, '/').replace(/@/g, '');
  }

  get field() {
    let field = fieldComponents.find(el => el.coreType === this.args.field.type);

    return field;
  }

  @action
  updateFieldProperties(element, [nonce]) {
    if (nonce !== this.currentNonce) {
      this.currentNonce = this.nonce;
      this.newFieldName = this.args.field.name;
      this.newFieldLabel = this.args.field.label;
      this.newFieldInstructions = this.args.field.instructions;
    }
    return null;
  }

  @action
  focusParentElement(element) {
    element.parentElement.focus({ preventScroll: true });
  }

  get nonce() {
    return onFieldChangedDependencies.map(i => this.args.field[i]).join('::');
  }

  get dasherizedType() {
    return dasherize(this.args.field.type.replace(/@cardstack\/core-types::/g, ''));
  }

  get friendlyType() {
    if (this.dasherizedType === 'case-insensitive' || this.dasherizedType === 'string') {
      return 'text';
    }

    return '';
  }

  get fieldViewer() {
    return `fields/${dasherize(this.sanitizedType)}-viewer`;
  }

  get fieldEditor() {
    return `fields/${dasherize(this.sanitizedType)}-editor`;
  }

  @action
  updateFieldName(newName) {
    try {
      this.args.setFieldName(this.args.field.name, newName);
      this.newFieldName = newName;
    } catch (e) {
      console.error(e); // eslint-disable-line no-console
      this.statusMsg = `field name ${this.args.field.name} was NOT successfully changed: ${e.message}`;
      return;
    }
  }

  @action
  updateFieldLabel(newLabel) {
    this.newFieldLabel = newLabel;
    this.args.setFieldLabel(this.args.field.name, this.newFieldLabel);
  }

  @action
  updateFieldInstructions(instructions) {
    this.newFieldInstructions = instructions;
    this.args.setFieldInstructions(this.args.field.name, this.newFieldInstructions);
  }

  @action
  selectField(field) {
    if (this.args.selectField) {
      this.args.selectField(field);
    }
  }

  @action initDrag(field, evt) {
    evt.target.parentNode.setAttribute('draggable', 'true');
    this.isDragging = field;
  }

  @action endDrag(evt) {
    evt.target.parentNode.setAttribute('draggable', 'false');
    this.isDragging = null;
  }

  @action startDragging(field, evt) {
    evt.dataTransfer.setData('text', evt.target.id);
    evt.dataTransfer.setData('text/field-name', field.name);
  }

  @action finishDragging(evt) {
    evt.target.setAttribute('draggable', 'false');
  }
}
