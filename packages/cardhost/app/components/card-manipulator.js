import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import { dasherize } from '@ember/string';
import { task } from "ember-concurrency";
import ENV from '@cardstack/cardhost/config/environment'

const { environment } = ENV;

const fieldTypeMappings = {
  string: '@cardstack/core-types::string',
  'case-insensitive string': '@cardstack/core-types::case-insensitive',
  boolean: '@cardstack/core-types::boolean',
  date: '@cardstack/core-types::date',
  integer: '@cardstack/core-types::integer',
  'related card': '@cardstack/core-types::belongs-to',
  'related cards': '@cardstack/core-types::has-many',

  // Probably want to omit these types as they could probably be better
  // handled as related cards:
  // '@cardstack/core-types::string-array',
  // '@cardstack/core-types::object',
};

export const fieldComponents = [
  {
    id: 'text-field',
    coreType: '@cardstack/core-types::string',
    title: 'Text',
    description: 'All-purpose text field',
    type: 'string',
    icon: `/assets/images/field-types/text.svg`
  },
  {
    id: 'text-field-case-insensitive',
    coreType: '@cardstack/core-types::case-insensitive',
    title: 'Text (case-insensitive)',
    description: 'Case-insensitive text field',
    type: 'case-insensitive string',
    icon: `/assets/images/field-types/text.svg`
  },
  {
    id: 'checkbox',
    coreType: '@cardstack/core-types::boolean',
    title: 'Checkbox',
    description: 'True/false (boolean) values',
    type: 'boolean',
    icon: `/assets/images/field-types/checkbox.svg`
  },
  {
    id: 'date-field',
    coreType: '@cardstack/core-types::date',
    title: 'Date',
    description: 'Date field',
    type: 'date',
    icon: `/assets/images/field-types/calendar.svg`
  },
  {
    id: 'number',
    coreType: '@cardstack/core-types::integer',
    title: 'Number',
    description: 'Integer number field',
    type: 'integer',
    icon: `/assets/images/field-types/number.png`
  },
  {
    id: 'dropdown',
    coreType: '@cardstack/core-types::belongs-to',
    title: 'Dropdown',
    description: 'Single select dropdown',
    type: 'related card',
    icon: `/assets/images/field-types/dropdown.svg`
  },
  {
    id: 'dropdown-multi',
    coreType: '@cardstack/core-types::has-many',
    title: 'Dropdown (Multi-select)',
    description: 'Multiple select dropdown',
    type: 'related cards',
    icon: `/assets/images/field-types/dropdown.svg`
  },
  // We'll need to figure out how to deal with the other types of ui-components, ex:
  // {
  //   id: 'text-area',
  //   title: 'Text Area',
  //   description: 'Multi-line text field',
  //   type: 'string',
  //   icon: `/assets/images/field-types/textarea.png`
  // },
  // {
  //   id: 'phone-number-field',
  //   title: 'Phone Number',
  //   description: 'Description',
  //   type: 'string',
  //   icon: `/assets/images/field-types/phone-number.png`
  // },
];

export default class CardManipulator extends Component {
  fieldTypeMappings = fieldTypeMappings;
  fieldComponents = fieldComponents;

  @service data;
  @service router;
  @service cardstackSession;

  @tracked statusMsg;
  @tracked card;
  @tracked selectedField;
  @tracked isDragging;
  @tracked selectedFieldName;
  @tracked selectedFieldLabel;

  constructor(...args) {
    super(...args);

    this.card = this.args.card;
  }

  get cardJson() {
    if (!this.card) { return null; }
    return JSON.stringify(this.card.json, null, 2);
  }

  get isDirtyStr() {
    return this.card.isDirty.toString();
  }

  get newFieldName() {
    return `new-field-${this.card.isolatedFields.length}`;
  }

  @(task(function * () {
    this.statusMsg = null;
    try {
      yield this.card.save();
    } catch (e) {
      console.error(e); // eslint-disable-line no-console
      this.statusMsg = `card ${this.card.name} was NOT successfully created: ${e.message}`;
      return;
    }
    this.router.transitionTo('cards.view', this.card.name);
  })) saveCard;

  @(task(function * () {
    this.statusMsg = null;
    try {
      yield this.card.delete();
    } catch (e) {
      console.error(e); // eslint-disable-line no-console
      this.statusMsg = `card ${this.card.name} was NOT successfully deleted: ${e.message}`;
      return;
    }
    this.router.transitionTo('index');
  })) deleteCard;

  @action
  removeField(fieldName) {
    if (!fieldName || !this.card) { return; }

    let field = this.card.getField(fieldName)
    field.remove();

    if (field === this.selectedField) {
      this.selectedField = null;
    }
  }

  @action
  addField(displayType, name, isEmbedded, value, position) {
    let type = displayType ? fieldTypeMappings[displayType] : null;
    if (!this.card || !type || !name) { return; }

    let field = this.card.addField({
      type,
      position,
      name: dasherize(name).toLowerCase(),
      neededWhenEmbedded: isEmbedded
    });

    if (value != null) {
      field.setValue(value);
    }
  }

  @action
  setPosition(fieldName, position) {
    if (!fieldName || !this.card || position == null) { return; }

    let card = this.card;
    card.moveField(card.getField(fieldName), position);
  }

  @action
  setNeededWhenEmbedded(fieldName, evt) {
    // this prevents 2-way data binding from trying to alter the Field
    // instance's neededWhenEmbedded value, which is bound to the input
    // that fired this action. Our data service API is very unforgiving when
    // you try to change the Field's state outside of the official API
    // (which is what ember is trying to do). Ember gets mad when it sees
    // that it can't alter the Field's state via the 2-way binding and
    // makes lots of noise. interestingly, this issue only seems to happen
    // when running tests. This work around has yucky visual side effects,
    // so only performing in the test env. A better solution would be to use/make
    // a one-way input control for setting the field.neededWhenEmbedded value.
    // The <Input> component is unfortunately, is not a one-way input helper
    if (environment === 'test') {
      evt.preventDefault();
    }

    let { target: { checked: neededWhenEmbedded } } = evt;
    this.card.getField(fieldName).setNeededWhenEmbedded(neededWhenEmbedded);
  }

  @action
  setFieldValue(fieldName, value) {
    if (!fieldName || !this.card) { return; }
    this.card.getField(fieldName).setValue(value);
  }

  @action
  setFieldName(oldFieldName, newFieldName) {
    this.card.getField(oldFieldName).setName(newFieldName);
  }

  @action
  updateFieldName(newName) {
    this.selectedFieldName = newName;
    this.setFieldName(this.selectedField.name, this.selectedFieldName);
  }

  @action
  setFieldLabel(fieldName, label) {
    this.card.getField(fieldName).setLabel(label);
  }

  @action
  updateFieldLabel(label) {
    this.selectedFieldLabel = label;
    this.setFieldLabel(this.selectedFieldName, this.selectedFieldLabel);
  }

  @action
  save() {
    this.saveCard.perform();
  }

  @action
  cancel() {
    this.router.transitionTo('cards.view', this.card.name);
  }

  @action
  delete() {
    this.deleteCard.perform();
  }

  @action
  beginDragging(fieldComponent, mousedownEvent) {
    let dragState = {
      usingKeyboard: false,
      initialPointerX: mousedownEvent.x,
      initialPointerY: mousedownEvent.y,
      latestPointerX: mousedownEvent.x,
      latestPointerY: mousedownEvent.y
    };

    this.isDragging = fieldComponent;
    fieldComponent.dragState = dragState;
    fieldComponent = fieldComponent; // eslint-disable-line no-self-assign
  }

  @action dropField(position, onFinishDrop) {
    let fieldComponent = this.isDragging;
    let field = this.card.addField({
      type: this.fieldTypeMappings[fieldComponent.type],
      position: position,
      name: this.newFieldName,
      neededWhenEmbedded: false
    });
    this.isDragging = false;
    this.selectedField = field;
    fieldComponent.dragState = null;
    fieldComponent = fieldComponent; // eslint-disable-line no-self-assign
    this.selectField(field);

    onFinishDrop();
  }

  @action selectField(field) {
    if (field.isDestroyed) { return; }

    this.selectedField = field;
    this.selectedFieldName = field.name;
    this.selectedFieldLabel = field.label;
  }

  @action firefoxDrag(evt) {
    // Chrome dragging works with just draggable="true",
    // but Firefox requires extra handling.
    evt.dataTransfer.setData("text", evt.target.id);
  }
}