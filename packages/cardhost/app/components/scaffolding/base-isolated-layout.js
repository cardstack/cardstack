import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { task } from 'ember-concurrency';
import { action } from '@ember/object';
import scaleBy from '@cardstack/cardhost/motions/scale';
import move from 'ember-animated/motions/move';
import opacity from 'ember-animated/motions/opacity';
import { easeInAndOut } from 'ember-animated/easings/cosine';
import { fadeOut } from 'ember-animated/motions/opacity';
import ENV from '@cardstack/cardhost/config/environment';

const { animationSpeed } = ENV;
const duration = 250;

export default class BaseIsolatedLayoutComponent extends Component {
  @service cssModeToggle;
  @tracked heading;
  @tracked subHeading;
  @tracked headerImage;

  duration = animationSpeed || duration;

  constructor(...args) {
    super(...args);

    this.loadSpecialHeader.perform();
  }

  get isViewMode() {
    if (!this.args.mode) {
      return null;
    }
    return this.args.mode === 'view' || this.args.mode === 'layout';
  }

  @task(function*() {
    if (!this.args.card || !this.args.card.attributes || !this.args.card.attributes.heading) {
      return;
    }
    this.heading = yield this.args.card.value('heading');
    this.subHeading = yield this.args.card.value('sub-heading');
    const image = yield this.args.card.value('header-image');
    this.headerImage = image ? image.href : null;
  })
  loadSpecialHeader;

  @action
  loadHeader() {
    this.loadSpecialHeader.perform();
  }

  *transition({ insertedSprites, keptSprites, removedSprites }) {
    let scaleFrom = 0.1;

    if (insertedSprites.length) {
      // don't fade out fields when saving a card
      if (insertedSprites.length !== removedSprites.length) {
        removedSprites.forEach(fadeOut);
      }
    } else {
      yield Promise.all(removedSprites.map(fadeOut));
    }
    yield Promise.all(keptSprites.map(move));

    insertedSprites.forEach(sprite => {
      let field = sprite.owner.value;

      // only do scale animation for newly added fields
      if (field.added && field.csRealm !== 'stub-card') {
        sprite.startTranslatedBy(
          ((1 - scaleFrom) / 2) * sprite.finalBounds.width,
          ((1 - scaleFrom) / 2) * sprite.finalBounds.height
        );
        sprite.scale(scaleFrom, scaleFrom);
        scaleBy(sprite, { by: 1 / scaleFrom, easing: easeInAndOut, duration });
        move(sprite, { easing: easeInAndOut, duration });
      }
      // only fade in when not saving a card. there is no more dirtiness--so need
      // a better way to know that you are not saving a card--perhaps the isRunning task state?
      if (field.csRealm !== 'stub-card') {
        opacity(sprite, { from: 0, easing: easeInAndOut, duration });
      }
    });
  }
}
