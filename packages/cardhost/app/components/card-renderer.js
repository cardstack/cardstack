import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import move from 'ember-animated/motions/move';
import adjustCSS from 'ember-animated/motions/adjust-css';
import { task, waitForProperty } from 'ember-concurrency';
import { scheduleOnce } from '@ember/runloop';

const duration = 250;
// TODO This will be part of the official API. Move this into core as it solidifies
export default class CardRenderer extends Component {
  @service cardstackSession;
  @service('-ea-motion') motion;

  @tracked actualFields;
  @tracked fields;
  @tracked mode;
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
    this.actualFields = yield this.args.card.fields();
    let fieldOrder = this.args.card.csFieldOrder;
    if (!fieldOrder) {
      this.fields = [...this.actualFields];
    } else {
      this.fields = [
        ...fieldOrder.map(i => this.actualFields.find(j => i === j.name)),
        ...this.actualFields.filter(i => !fieldOrder.includes(i.name)),
      ];
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

  @(task(function*(field, position, isAdding) {
    yield this.loadCard.last.then();
    if (!this.args.fieldOrderPromise || this.args.fieldOrderPromise.isFulfilled()) {
      if (isAdding) {
        this.fields.splice(position, 0, field);
      } else if (!isAdding) {
        this.fields.splice(position, 1);
      }
    } else if (!isAdding) {
      // we want to time this so that we don't try to remove the field "drop
      // shadow" before the new field has been added--otherwise it looks like a
      // field was added, then removed, and then readded.
      yield Promise.resolve(this.args.fieldOrderPromise);
    }

    // this identity map is necessary because of REASONS. animated-each doesn't
    // seem to pick it up otherwise.
    this.fields = this.fields.map(i => i);
  }).restartable())
  updateFields;

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
