import BaseEditor from '../base-editor';
import { task } from 'ember-concurrency';
import { htmlSafe } from '@ember/template';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
// import { getUserRealm } from '../../../utils/scaffolding';

const size = 100;
const defaultRegistry = 'library';

export default class BaseCardFieldEditLayout extends BaseEditor {
  @service data;
  @tracked realmURL;
  @tracked realmName;
  @tracked template;
  @tracked displayInputField;
  @tracked searchKey;
  @tracked cardSet = [];

  get dataSource() {
    return htmlSafe(`Searching for <span>${this.args.card.csTitle}</span> within <span>${this.realmName}</span>`);
  }

  constructor(...args) {
    super(...args);

    this.displayInputField = false;
    this.fieldInstructions = this.args.card.csDescription;
    this.realmURL = this.args.card.csRealm;

    if (this.realmURL) {
      let segments = this.realmURL.split('/');
      this.realmName = segments[segments.length - 1];
      if (this.realmName === 'default') {
        this.realmName = defaultRegistry;
      }
    }
  }

  @action
  openCardSelector() {
    this.displayInputField = true;
  }

  @action
  closeCardSelector() {
    this.displayInputField = false;
  }

  @action
  focusSearch(container) {
    container.querySelector('input').focus();
  }

  @(task(function*() {
    let relatedCard = yield this.args.card.enclosingCard.value(this.args.card.name);
    if (relatedCard) {
      this.fieldValue = relatedCard;
    } else {
      this.fieldValue = null;
    }
  }).drop())
  load;

  @(task(function*(card) {
    if (this.args.card.csFieldArity === 'plural') {
      this.fieldValue = [...this.fieldValue, card];
    } else {
      this.fieldValue = card;
      this.displayInputField = false;
    }
    yield this.args.setCardReference.perform(this.args.card.name, this.fieldValue);
  }).restartable())
  updateFieldValue;

  @task(function*(value) {
    if (!value) {
      return;
    }

    let hasKeyField = yield this.args.card.hasField('key');
    if (!hasKeyField) {
      return;
    }
    let key = yield this.args.card.value('key');

    if (!this.searchKey || key !== this.searchKey || !this.cardSet.length) {
      this.searchKey = key;
      this.cardSet = yield this.data.search(
        {
          filter: {
            type: { csRealm: this.realmURL, csId: key },
          },
          sort: '-csCreated',
          page: { size },
        },
        { includeFieldSet: 'embedded' }
      );
    }

    let results = this.cardSet.filter(a => a.attributes.title.toLowerCase().includes(value.toLowerCase()));
    if (!results.length) {
      return;
    }
    return results;
  })
  search;

  @task(function*(card) {
    if (this.args.card.csFieldArity === 'plural') {
      this.fieldValue = this.fieldValue.filter(el => card.csId !== el.csId);
    } else {
      this.fieldValue = null;
    }
    yield this.args.setCardReference.perform(this.args.card.name, this.fieldValue);
  })
  remove;
}
