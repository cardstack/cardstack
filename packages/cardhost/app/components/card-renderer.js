import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import move from 'ember-animated/motions/move';
import adjustCSS from 'ember-animated/motions/adjust-css';
import { task } from 'ember-concurrency';

const duration = 250;
// TODO This will be part of the official API. Move this into core as it solidifies
export default class CardRenderer extends Component {
  @service cardstackSession;

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
    this.loadCard.perform();
  }

  @task(function*() {
    this.actualFields = yield this.args.card.fields();
    this.fields = [...this.actualFields];
  })
  loadCard;

  @(task(function*(field, position, isAdding) {
    yield this.loadCard.last.finally();

    if (!this.args.addFieldPromise || this.args.addFieldPromise.isFulfilled()) {
      if (isAdding) {
        this.fields.splice(position, 0, field);
      } else if (!isAdding) {
        this.fields.splice(position, 1);
      }
    } else if (!isAdding) {
      // we want to time this so that we don't try to remove the field "drop
      // shadow" before the new field has been added--otherwise it looks like a
      // field was added, then removed, and then readded.
      yield Promise.resolve(this.args.addFieldPromise);
    }

    // this identity map is necessary because of REASONS. animated-each doesn't
    // seem to pick it up otherwise.
    this.fields = this.fields.map(i => i);
  }).enqueue())
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
