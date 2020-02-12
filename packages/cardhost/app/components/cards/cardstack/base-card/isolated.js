import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import scaleBy from '../../../../motions/scale';
import move from 'ember-animated/motions/move';
import opacity from 'ember-animated/motions/opacity';
import { easeInAndOut } from 'ember-animated/easings/cosine';
import { fadeIn, fadeOut } from 'ember-animated/motions/opacity';
import { printSprites } from 'ember-animated';
import drag from '../../../../motions/drag';
import ENV from '@cardstack/cardhost/config/environment';

const { animationSpeed } = ENV;
const duration = 250;

export default class IsolatedComponent extends Component {
  @service draggable;

  duration = animationSpeed || duration;

  *transition({ insertedSprites, keptSprites, removedSprites }) {
    printSprites(arguments[0], 'field transitions');
    let scaleFrom = 0.1;

    let activeSprite = keptSprites.find(sprite => sprite.owner.value.dragState);
    let others = keptSprites.filter(sprite => sprite !== activeSprite);

    if (activeSprite) {
      drag(activeSprite, {
        others,
        direction: 'y',
      });
      yield Promise.all(others.map(move));
    } else {
      if (insertedSprites.length) {
        removedSprites.forEach(fadeOut);
      } else {
        yield Promise.all(removedSprites.map(fadeOut));
      }
      yield Promise.all(keptSprites.map(move));
      insertedSprites.forEach(fadeIn);
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

  @action
  initMousedown(evt) {
    this.draggable.triggerEvent(evt.target.parentNode, 'mousedown');
  }

  @action
  initClick(evt) {
    this.draggable.triggerEvent(evt.target.parentNode, 'click');
  }

  // *transition({ keptSprites }) {
  //   let activeSprite = keptSprites.find(sprite => sprite.owner.value.dragState);
  //   let others = keptSprites.filter(sprite => sprite !== activeSprite);

  //   if (activeSprite) {
  //     drag(activeSprite, {
  //       others,
  //     });
  //     let ghostElement = getGhostFromSprite(activeSprite);
  //     activeSprite.element.parentElement.appendChild(ghostElement);
  //     others.forEach(move);
  //   } else {
  //     keptSprites.forEach(sprite => {
  //       move(sprite, { duration: 300 });
  //     });
  //   }
  // }
}
