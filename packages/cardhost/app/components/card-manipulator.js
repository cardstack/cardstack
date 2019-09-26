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

    this.card.removeField(field);
  }

  @action
  addField(type, name, isEmbedded, value) {
    let fieldType = type ? fieldTypeMappings[type] : null;
    if (!this.card || !fieldType || !name) { return; }
    let field = dasherize(name).toLowerCase();
    this.card.addField({
      data: {
        id: field,
        type: 'fields',
        attributes: {
          'is-metadata': true,
          'needed-when-embedded': Boolean(isEmbedded),
          'field-type': fieldType
        },
      },
    });

    if (value != null) {
      this.card.setFieldValue(field, value);
    }
  }

  @action
  setField(field, value) {
    if (!field || !this.card) { return; }
    this.card.setFieldValue(field, value);
  }

  @action
  save() {
    this.saveCard.perform();
  }
}