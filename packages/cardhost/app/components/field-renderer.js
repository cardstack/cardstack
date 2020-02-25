import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { task } from 'ember-concurrency';
import kebabCase from 'lodash/kebabCase';
import { inject as service } from '@ember/service';

const defaultSchemaAttrs = Object.freeze(['title', 'type', 'name', 'instructions', 'embedded']);
const fieldNameRegex = Object.freeze(/^[a-zA-Z][\w-]*$/);

export default class FieldRenderer extends Component {
  fieldNameRegex = fieldNameRegex;
  @tracked newFieldName;
  @tracked currentFieldName;
  @tracked newFieldLabel;
  @tracked newFieldInstructions;
  @tracked fieldValue;
  @tracked fieldType;
  @tracked fieldTypeId;
  @tracked neededWhenEmbedded;

  @service draggable;

  constructor(...args) {
    super(...args);

    this.newFieldName = this.args.field.name;
    this.currentFieldName = this.args.field.name;
    this.newFieldLabel = this.args.field.csTitle;
    this.newFieldInstructions = this.args.field.csDescription;
    if (this.args.field.enclosingCard) {
      this.neededWhenEmbedded =
        this.args.field.enclosingCard.csFieldSets && Array.isArray(this.args.field.enclosingCard.csFieldSets.embedded)
          ? this.args.field.enclosingCard.csFieldSets.embedded.includes(this.args.field.name)
          : false;
    }
    this.loadField.perform();
  }

  @task(function*() {
    if (this.args.field.enclosingCard) {
      this.fieldValue = yield this.args.field.enclosingCard.value(this.args.field.name);
    }
    let fieldTypeCard = yield this.args.field.adoptsFrom();
    this.fieldType = fieldTypeCard.csTitle;
    this.fieldTypeId = fieldTypeCard.canonicalURL;
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
    return this.args.field.csRealm === 'stub-card';
  }

  get stubFieldName() {
    if (!this.isStubField) {
      return null;
    }

    return this.args.field.csDescription || this.args.field.csTitle;
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
    this.draggable.setDragging(true);
  }

  @action endDrag(evt) {
    evt.target.parentNode.setAttribute('draggable', 'false');
    this.draggable.setDragging(false);
  }

  @action startDragging(field) {
    this.draggable.setField(field, this.args.position);
  }

  @action finishDragging(evt) {
    this.draggable.clearField();
    evt.target.setAttribute('draggable', 'false');
  }
}
