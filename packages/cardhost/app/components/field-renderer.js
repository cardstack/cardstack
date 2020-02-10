import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { task } from 'ember-concurrency';
import kebabCase from 'lodash/kebabCase';

const defaultSchemaAttrs = ['title', 'type', 'name', 'instructions', 'embedded'];

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
    this.newFieldLabel = this.args.field.csTitle;
    this.newFieldInstructions = this.args.field.csDescription;
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
      this.statusMsg = `field name ${this.currentFieldName} was NOT successfully changed: ${e.message}`;
      return;
    }
  }).restartable())
  updateFieldName;

  @(task(function*(newLabel) {
    this.newFieldLabel = newLabel;
    yield this.args.setFieldCardValue.perform(this.currentFieldName, 'csTitle', newLabel);
  }).restartable())
  updateFieldLabel;

  @(task(function*(instructions) {
    this.newFieldInstructions = instructions;
    yield this.args.setFieldCardValue.perform(this.currentFieldName, 'csDescription', instructions);
  }).restartable())
  updateFieldInstructions;

  get schemaAttrs() {
    return this.args.schemaAttrs || defaultSchemaAttrs;
  }

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

  get fieldLabel() {
    return this.newFieldLabel || this.args.field.csTitle;
  }

  @action
  focusParentElement(element) {
    element.parentElement.focus({ preventScroll: true });
  }

  get fieldDisplayName() {
    return this.fieldLabel || this.fieldName;
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
