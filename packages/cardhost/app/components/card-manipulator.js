import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import { dasherize } from '@ember/string';
import { task } from "ember-concurrency";

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

export default class CardManipulator extends Component {
  fieldTypeMappings = fieldTypeMappings;

  @service data;
  @service cardstackSession;

  @tracked statusMsg;
  @tracked card;

  constructor(...args) {
    super(...args);

    this.card = this.args.card;
  }

  get cardJson() {
    if (!this.card) { return null; }
    return JSON.stringify(this.card.json, null, 2);
  }

  @(task(function * () {
    this.statusMsg = null;
    let isNew = this.card.isNew;
    try {
      yield this.card.save();
    } catch (e) {
      console.error(e); // eslint-disable-line no-console
      this.statusMsg = `card ${this.card.id} was NOT successfully created: ${e.message}`;
      return;
    }
    if (isNew && typeof this.afterCreate === 'function') {
      yield this.afterCreate(this.card.id);
    }
    if (!isNew && typeof this.afterUpdate === 'function') {
      yield this.afterUpdate(this.card.id);
    }
  })) saveCard;

  @action
  removeField(field) {
    if (!field || !this.card) { return; }

    this.card.getField(field).remove();
  }

  @action
  addField(displayType, name, isEmbedded, value) {
    let type = displayType ? fieldTypeMappings[displayType] : null;
    if (!this.card || !type || !name) { return; }

    let field = this.card.addField({
      type,
      name: dasherize(name).toLowerCase(),
      neededWhenEmbedded: isEmbedded
    });

    if (value != null) {
      field.setValue(value);
    }
  }

  @action
  setField(field, value) {
    if (!field || !this.card) { return; }
    this.card.getField(field).setValue(value);
  }

  @action
  save() {
    this.saveCard.perform();
  }
}