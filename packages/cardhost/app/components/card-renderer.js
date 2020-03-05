import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { dasherize } from '@ember/string';
import { A } from '@ember/array';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import move from 'ember-animated/motions/move';
import resize from 'ember-animated/motions/resize';
import adjustCSS from 'ember-animated/motions/adjust-css';
import opacity from 'ember-animated/motions/opacity';
import { easeInAndOut } from 'ember-animated/easings/cosine';
import { parallel } from 'ember-animated';
import ENV from '@cardstack/cardhost/config/environment';

// TODO we'll need to use EC in order to be able to isolate cards
// (due to the need to await the load of the isolated format of a card)
// import { task } from "ember-concurrency";
const { animationSpeed } = ENV;
const duration = animationSpeed || 250;

// TODO This will be part of the official API. Move this into core as it solidifies
export default class CardRenderer extends Component {
  @service cardstackSession;
  @tracked componentName;
  @tracked mode;
  @tracked cardFocused = () => {};
  @tracked fields = A([]);

  duration = duration;

  constructor(...args) {
    super(...args);

    // TODO eventually this will be derived based on the presence of a card's
    // custom template/component assets, and we'll use the @card.id for the
    // component name
    this.componentName = '@cardstack/base-card';
    this.mode = this.args.mode || 'view';

    if (this.args.cardFocused) {
      this.cardFocused = this.args.cardFocused;
    }

    if (this.args.card && this.args.format === 'isolated') {
      this.fields = A(Object.assign([], this.args.card.isolatedFields));
    }
  }

  @action
  updateFields(element, [fields]) {
    this.fields = A(Object.assign([], fields));
  }

  @action
  toggleStubField(field, position, addField) {
    if (position || position === 0) {
      if (addField) {
        // remove other stub fields first
        this.fields = this.fields.filter(field => !field.preview);
        // check if adding at the end
        if (position < this.fields.length) {
          this.fields.insertAt(position, field);
        } else {
          this.fields.addObject(field);
        }
      } else {
        // don't remove a field that's not a stub field
        if (this.fields[position].preview) {
          this.fields.removeAt(position);
        }
      }
    }
  }

  @action
  cardIsFocused(value) {
    this.cardFocused(value);
  }

  @action
  focusCard(element, [value]) {
    this.cardFocused(value);
  }

  get sanitizedName() {
    return this.componentName.replace(/@/g, '');
  }

  get embeddedComponentName() {
    return `cards/${dasherize(this.sanitizedName)}/embedded`;
  }

  get isolatedComponentName() {
    return `cards/${dasherize(this.sanitizedName)}/isolated`;
  }

  *headerAnimation({ keptSprites, receivedSprites }) {
    keptSprites.forEach(sprite => {
      move(sprite, { duration });
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
      sprite.applyStyles({ 'z-index': '5' });
      adjustCSS('border-top-right-radius', sprite, { duration });
      adjustCSS('border-top-left-radius', sprite, { duration });
    });
  }

  *contentTransition({ receivedSprites }) {
    if (receivedSprites.length) {
      receivedSprites.forEach(sprite => {
        sprite.moveToFinalPosition();
        opacity(sprite, { from: 0, easing: easeInAndOut, duration });
      });
    }
  }
}
