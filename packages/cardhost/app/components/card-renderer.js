import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import move from 'ember-animated/motions/move';
import adjustCSS from 'ember-animated/motions/adjust-css';
import { task, waitForProperty, timeout } from 'ember-concurrency';
import { scheduleOnce } from '@ember/runloop';
import difference from 'lodash/difference';
import { set } from '@ember/object';
import ENV from '@cardstack/cardhost/config/environment';

const { animationSpeed } = ENV;
const duration = animationSpeed || 250;

export default class CardRenderer extends Component {
  @service cardstackSession;
  @service('-ea-motion') motion;

  @tracked actualFields;
  @tracked previousFieldNames;
  @tracked fields;
  @tracked mode;
  @tracked fieldsToRemove = new Map();
  @tracked cardFocused = () => {};

  duration = duration;

  constructor(...args) {
    super(...args);
    this.mode = this.args.mode || 'view';

    if (this.args.cardFocused) {
      this.cardFocused = this.args.cardFocused;
    }
    this.doOnLoadComplete.perform();
  }

  @(task(function*() {
    let actualFields = yield this.args.card.fields();
    if (Array.isArray(this.previousFieldNames)) {
      let addedFieldNames = difference(
        actualFields.map(f => f.name),
        this.previousFieldNames
      );
      for (let field of actualFields) {
        // UGH, this is a temp solution until I come up with something better. we
        // should not be monkey patching the API
        if (addedFieldNames.includes(field.name)) {
          field.added = true;
        } else {
          delete field.added;
        }
      }
    }
    this.actualFields = actualFields;
    this.previousFieldNames = this.actualFields.map(f => f.name);
    let fieldOrder = this.args.card.csFieldOrder;
    if (!fieldOrder) {
      this.fields = [...this.actualFields];
    } else {
      this.fields = [
        ...fieldOrder.map(i => this.actualFields.find(j => i === j.name)),
        ...this.actualFields.filter(i => !fieldOrder.includes(i.name)),
      ];
    }
    let position = 0;
    for (let field of this.fields) {
      if (field.csRealm !== 'stub-card') {
        set(field, 'position', position++);
      }
    }
  }).drop())
  loadCard;

  @task(function*() {
    yield this.loadCard.perform();
    if (typeof this.args.cardLoaded === 'function') {
      let onRenderComplete;
      let render = new Promise(res => (onRenderComplete = res));
      yield this.loadCard.last.then();
      scheduleOnce('afterRender', this, onRenderComplete);
      yield render;
      yield waitForProperty(this.motion, 'isAnimating', false);
      yield this.args.cardLoaded();
    }
  })
  doOnLoadComplete;

  @(task(function*(nonce, position, field) {
    yield this.loadCard.last.then();
    // eslint-disable-next-line no-console
    console.log(
      `Received request to ${field ? 'add' : 'remove'} field with nonce ${nonce}${
        field ? ' at position ' + position : ''
      }`
    );
    // these events arent always delivered in order. instead of trying to manage
    // this with an array, we use an identity map for the drop zones so
    // we can more easily remove the correct drop zone regardless of position.
    if (!this.args.fieldOrderPromise || this.args.fieldOrderPromise.isFulfilled()) {
      if (field && !this.fields.find(f => f.dropZoneNonce === nonce)) {
        console.log(`Adding field at position ${position} with nonce ${nonce}`); // eslint-disable-line no-console
        let outstandingStubFields = this.fields.filter(f => f.csRealm === 'stub-card');
        for (let fieldToRemove of outstandingStubFields) {
          this.fieldsToRemove.set(
            fieldToRemove.dropZoneNonce,
            this.autoRemoveStubField.perform(fieldToRemove.dropZoneNonce)
          );
        }
        this.fields.splice(position, 0, field);
      } else if (!field) {
        if (this.fieldsToRemove.get(nonce)) {
          this.fieldsToRemove.get(nonce).cancel();
        }
        console.log(`Removing field at with nonce ${nonce}`); // eslint-disable-line no-console
        this.fields = this.fields.filter(f => f.dropZoneNonce !== nonce);
      }
    } else if (!field) {
      // we want to time this so that we don't try to remove the field "drop
      // shadow" before the new field has been added--otherwise it looks like a
      // field was added, then removed, and then readded.
      yield Promise.resolve(this.args.fieldOrderPromise);
    }

    // this identity map is necessary because of REASONS. animated-each doesn't
    // seem to pick it up otherwise.
    this.fields = this.fields.map(i => i);
  }).enqueue())
  updateFields;

  @(task(function*(nonce) {
    yield timeout(750);
    if (this.fieldsToRemove.get(nonce)) {
      // eslint-disable-next-line no-console
      console.log(
        `Auto removing field at with nonce ${nonce} because a new stub-field was added when a stub field was already present`
      );
      this.fields = this.fields.filter(f => f.dropZoneNonce !== nonce);
      this.fieldsToRemove.delete(nonce);
    }
  }).enqueue())
  autoRemoveStubField;

  @action
  cardUpdated() {
    this.loadCard.perform();
  }

  @action
  toggleStubField(field, position, isAdding) {
    this.updateFields.perform(field, position, isAdding);
  }

  @action
  cardIsFocused(value) {
    this.cardFocused(value);
  }

  @action
  focusCard(element, [value]) {
    this.cardFocused(value);
  }

  *headerAnimation({ keptSprites }) {
    keptSprites.forEach(sprite => {
      move(sprite, { duration });
    });
  }

  *borderAnimation({ keptSprites }) {
    keptSprites.forEach(sprite => {
      adjustCSS('border-top-right-radius', sprite, { duration });
      adjustCSS('border-top-left-radius', sprite, { duration });
    });
  }
}
