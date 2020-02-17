import Component from '@glimmer/component';
import scaleBy from '../../../../motions/scale';
import move from 'ember-animated/motions/move';
import opacity from 'ember-animated/motions/opacity';
import { easeInAndOut } from 'ember-animated/easings/cosine';

import { fadeOut } from 'ember-animated/motions/opacity';
import ENV from '@cardstack/cardhost/config/environment';

const { animationSpeed } = ENV;
const duration = 250;

export default class IsolatedComponent extends Component {
  duration = animationSpeed || duration;

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
      if (!field.preview && field.card.isDirty) {
        sprite.startTranslatedBy(
          ((1 - scaleFrom) / 2) * sprite.finalBounds.width,
          ((1 - scaleFrom) / 2) * sprite.finalBounds.height
        );
        sprite.scale(scaleFrom, scaleFrom);
        scaleBy(sprite, { by: 1 / scaleFrom, easing: easeInAndOut, duration });
        move(sprite, { easing: easeInAndOut, duration });
      }
      // only fade in when not saving a card
      if (field.preview || field.card.isDirty) {
        opacity(sprite, { from: 0, easing: easeInAndOut, duration });
      }
    });
  }
}
