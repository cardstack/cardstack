import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import move from 'ember-animated/motions/move';
import resize from 'ember-animated/motions/resize';
import adjustCSS from 'ember-animated/motions/adjust-css';
import { task, waitForProperty, timeout } from 'ember-concurrency';
import { scheduleOnce } from '@ember/runloop';
import difference from 'lodash/difference';
import isEqual from 'lodash/isEqual';
import { set } from '@ember/object';
import { easeInAndOut } from 'ember-animated/easings/cosine';
import { parallel } from 'ember-animated';
import ENV from '@cardstack/cardhost/config/environment';
import { reads } from '@ember/object/computed';

const { animationSpeed } = ENV;
const duration = animationSpeed || 500;

export default class CardRenderer extends Component {
  loadedFields = [];
  @service cardstackSession;
  @service('css') cssService;
  @service('-ea-motion') motion;

  @tracked actualFields;
  @tracked previousFieldNames;
  @tracked fields;
  @tracked mode;
  @tracked css;
  @tracked fieldsToRemove = new Map();
  @tracked cardFocused = () => {};
  @tracked fieldsLoadedNonce = 0;

  // These are aliased so they can be watched by animatedWatchFields, as animated-value
  // does not support key paths in its watch argument
  @reads('args.card') cardFromArgs;
  @reads('args.cardSelected') cardSelectedFromArgs;
  animatedWatchFields = 'cardFromArgs,cardSelectedFromArgs,fieldsLoadedNonce';

  loadingIsolatedCss = `
    .card-renderer-isolated--card-container {
      background-color: white;
      color: white;
    }
  `;
  loadingEmbeddedCss = `
    .embedded-card {
      background-color: white;
      color: white;
    }
  `;

  duration = duration;

  constructor(...args) {
    super(...args);
    this.mode = this.args.mode || 'view';

    if (this.args.cardFocused) {
      this.cardFocused = this.args.cardFocused;
    }
    set(this.args.card, 'mode', this.mode); // ugh, not a great solution...
    this.initialLoad.perform();
  }

  @task(function*() {
    // This means that we only occlude fields based on format when you ask for a
    // card to be rendered in its view mode. Meaning that in the edit mode you
    // can see all fields regardless of fieldset rules. I think this is
    // correct... (not to be confused with the rules around permissions which
    // are totally separate to the format based occlusion rules).
    let fieldsetFormatRule = this.mode === 'view' ? this.args.format : 'everything';
    return yield this.args.card.fields({ includeFieldSet: fieldsetFormatRule });
  })
  getFields;

  @(task(function*() {
    this.loadedFields = [];

    let tasks = [this.getFields.perform()];
    if (!this.args.suppressCss && (this.mode === 'view' || this.mode === 'layout')) {
      tasks.push(this.args.card.loadFeature(`${this.args.format}-css`));
    }

    let [actualFields, css] = yield Promise.all(tasks);
    if (
      !this.args.suppressCss &&
      !(this.args.format === 'isolated' && (this.mode === 'schema' || this.mode === 'edit'))
    ) {
      this.css = css;
      this.cssService.addCard(this.args.card, this.args.format, css);
    } else {
      this.css = undefined;
      this.cssService.removeCard(this.args.card, this.args.format);
    }

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
        ...fieldOrder.map(i => this.actualFields.find(j => i === j.name)).filter(Boolean),
        ...this.actualFields.filter(i => !fieldOrder.includes(i.name)),
      ];
    }
    let position = 0;
    for (let field of this.fields) {
      if (field.csRealm !== 'stub-card') {
        set(field, 'position', position++);
      }
    }

    set(this.args.card, 'mode', this.mode);
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
  initialLoad;

  @(task(function*(fieldName) {
    let fields = yield this.getFields.perform();
    this.loadedFields.push(fieldName);
    if (isEqual(fields.map(f => f.name).sort(), this.loadedFields.sort())) {
      this.fieldsLoadedNonce = ++this.fieldsLoadedNonce;
    }
  }).enqueue())
  loadedField;

  @(task(function*(nonce, position, field) {
    yield this.loadCard.last.then();
    // these events arent always delivered in order. instead of trying to manage
    // this with an array, we use an identity map for the drop zones so
    // we can more easily remove the correct drop zone regardless of position.
    if (!this.args.fieldOrderPromise || this.args.fieldOrderPromise.isFulfilled()) {
      if (field && !this.fields.find(f => f.dropZoneNonce === nonce)) {
        let outstandingStubFields = this.fields.filter(f => f.csRealm === 'stub-card');
        for (let fieldToRemove of outstandingStubFields) {
          if (!this.fieldsToRemove.has(fieldToRemove.dropZoneNonce)) {
            this.fieldsToRemove.set(
              fieldToRemove.dropZoneNonce,
              this.autoRemoveStubField.perform(fieldToRemove.dropZoneNonce)
            );
          }
        }
        this.fields.splice(position, 0, field);
      } else if (!field) {
        if (this.fieldsToRemove.has(nonce)) {
          this.fieldsToRemove.get(nonce).cancel();
        }
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
      this.fields = this.fields.filter(f => f.dropZoneNonce !== nonce);
      this.fieldsToRemove.delete(nonce);
    }
  }).enqueue())
  autoRemoveStubField;

  @action
  removeCardCss() {
    this.cssService.removeCard(this.args.card, this.args.format);
  }

  @action
  cardUpdated() {
    this.loadCard.perform();
  }

  @action
  toggleStubField(nonce, position, field) {
    this.updateFields.perform(nonce, position, field);
  }

  @action
  cardIsFocused(value) {
    this.cardFocused(value);
  }

  @action
  focusCard(element, [value]) {
    this.cardFocused(value);
  }

  @action
  setIsSelected(value) {
    if (this.args.setIsSelected) {
      this.args.setIsSelected(value);
    }
  }

  *headerAnimation({ keptSprites, receivedSprites }) {
    keptSprites.forEach(sprite => {
      parallel(move(sprite, { easing: easeInAndOut, duration }), resize(sprite, { easing: easeInAndOut, duration }));
    });

    if (receivedSprites.length) {
      receivedSprites.forEach(sprite => {
        sprite.applyStyles({ 'z-index': '1', 'background-color': 'transparent' });
        parallel(move(sprite, { easing: easeInAndOut, duration }), resize(sprite, { easing: easeInAndOut, duration }));
      });
    }
  }

  *cardTransition({ keptSprites, receivedSprites }) {
    if (receivedSprites.length) {
      receivedSprites.forEach(sprite => {
        sprite.applyStyles({ 'z-index': '16' });
        parallel(move(sprite, { easing: easeInAndOut, duration }), resize(sprite, { easing: easeInAndOut, duration }));
        adjustCSS('border-top-right-radius', sprite, { duration });
        adjustCSS('border-top-left-radius', sprite, { duration });
      });
    }

    keptSprites.forEach(sprite => {
      sprite.applyStyles({ 'z-index': '16' });
      parallel(move(sprite, { easing: easeInAndOut, duration }), resize(sprite, { easing: easeInAndOut, duration }));
      adjustCSS('border-top-right-radius', sprite, { duration });
      adjustCSS('border-top-left-radius', sprite, { duration });
    });
  }
}
