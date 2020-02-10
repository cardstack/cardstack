import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { task } from 'ember-concurrency';
import kebabCase from 'lodash/kebabCase';

const defaultSchemaAttrs = ['title', 'type', 'name', 'instructions', 'embedded'];

// These are the field attributes that will trigger onFieldChanged()
// to be called when the values of this attributes change
// const onFieldChangedDependencies = ['nonce', 'name', 'label', 'instructions'];

export default class FieldRenderer extends Component {
  @tracked newFieldName;
  @tracked currentFieldName;
  @tracked newFieldLabel;
  @tracked newFieldInstructions;
  @tracked fieldValue;
  @tracked fieldType;
  @tracked currentNonce;
  @tracked renderNonce;

  constructor(...args) {
    super(...args);

    this.newFieldName = this.args.field.name;
    this.currentFieldName = this.args.field.name;
    this.newFieldLabel = this.args.field.label;
    this.newFieldInstructions = this.args.field.instructions;
    this.loadField.perform();
  }

  @task(function*() {
    if (this.isStubField) {
      this.fieldType = 'New Field';
    } else {
      this.fieldValue = yield this.args.field.enclosingCard.value(this.args.field.name);
      let fieldTypeCard = yield this.args.field.adoptsFrom();
      this.fieldType = fieldTypeCard.csTitle;
    }
  })
  loadField;

  @(task(function*(newName) {
    newName = kebabCase(newName);
    try {
      yield this.args.setFieldName.perform(this.currentFieldName, newName);
      this.currentFieldName = newName;
    } catch (e) {
      console.error(e); // eslint-disable-line no-console
      this.statusMsg = `field name ${this.currentFieldNAme} was NOT successfully changed: ${e.message}`;
      return;
    }
  }).restartable())
  updateFieldName;

  get schemaAttrs() {
    return this.args.schemaAttrs || defaultSchemaAttrs;
  }

  // get sanitizedType() {
  //   return this.args.field.type.replace(/::/g, '/').replace(/@/g, '');
  // }

  // get fieldType() {
  //   return fieldComponents.find(el => el.coreType === this.args.field.type);
  // }

  get isSelected() {
    return (
      this.args.selectedField &&
      (this.args.selectedField.name === this.args.field.name || this.args.selectedFieldName === this.args.field.name)
    );
  }

  get isStubField() {
    return this.args.field.csOriginalRealm === 'stub-card';
  }

  get fieldName() {
    return this.newFieldName || this.args.field.name;
  }

  @action
  focusParentElement(element) {
    element.parentElement.focus({ preventScroll: true });
  }

  // get nonce() {
  //   return onFieldChangedDependencies.map(i => this.args.field[i]).join('::');
  // }

  // get dasherizedType() {
  //   return dasherize(this.args.field.type.replace(/@cardstack\/core-types::/g, ''));
  // }

  // get friendlyType() {
  //   if (this.dasherizedType === 'case-insensitive' || this.dasherizedType === 'string') {
  //     return 'text';
  //   }

  //   return '';
  // }

  // get fieldViewer() {
  //   return `fields/${dasherize(this.sanitizedType)}-viewer`;
  // }

  // get fieldEditor() {
  //   return `fields/${dasherize(this.sanitizedType)}-editor`;
  // }

  get fieldDisplayName() {
    return this.args.field.csTitle || this.args.field.name;
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
  selectField(field, evt) {
    if (this.args.selectField) {
      this.args.selectField(field, evt);
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
