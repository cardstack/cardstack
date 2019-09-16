import Controller from '@ember/controller';
import { action, set } from '@ember/object';

// import { printSprites } from 'ember-animated';
import move from 'ember-animated/motions/move';
import opacity from 'ember-animated/motions/opacity';
import scale from '../../../motions/scale';
import keep from '../../../motions/keep';
import resize from 'ember-animated/motions/resize';
import { easeInAndOut } from 'ember-animated/easings/cosine';

export let duration = 600;

export default class DemoFormCardsIndexController extends Controller {
  @action edit(card) {
    for (let elt of this.model) {
      if (elt.id === card.id) {
        set(elt, 'expanded', !elt.expanded);
        this.transitionToRoute('form-cards.edit', elt);
      } else {
        set(elt, 'expanded', false);
      }
    }
  }

  * wait({ removedSprites, receivedSprites }) {
    // printSprites(arguments[0], 'index outer transition');
    removedSprites.concat(receivedSprites).forEach(keep);
  }

  * backgroundTransition({ removedSprites, insertedSprites, receivedSprites }) {
    // printSprites(arguments[0], 'index background transition');

    let factor = 0.8;

    removedSprites.forEach(sprite => {
      sprite.endAtPixel({
        x: sprite.initialBounds.left + ((1 - factor) / 2 * sprite.initialBounds.width),
        y: sprite.initialBounds.top + ((1 - factor) / 2 * sprite.initialBounds.height)
      });
      opacity(sprite, { to: 0, easing: easeInAndOut, duration });
      scale(sprite, { by: factor, easing: easeInAndOut, duration });
      move(sprite, { easing: easeInAndOut, duration });
      sprite.applyStyles({ 'z-index': 1 });
    });

    insertedSprites.concat(receivedSprites).forEach(sprite => {
      sprite.startAtPixel({
        x: sprite.finalBounds.left + ((1 - factor) / 2 * sprite.finalBounds.width),
        y: sprite.finalBounds.top + ((1 - factor) / 2 * sprite.finalBounds.height)
      });
      sprite.scale(factor, factor);
      opacity(sprite, { from: 0, easing: easeInAndOut, duration });
      scale(sprite, { by: 1 / factor, easing: easeInAndOut, duration });
      move(sprite, { easing: easeInAndOut, duration });
      sprite.applyStyles({ 'z-index': 1 });
    });
  }

  /*
    TODO: unlike the box transition animation, the animation for the div that supplies box-shadow
    doesn't work as expected when moved to `receivedSprites` in `edit.js`
  */
  * shadowTransition({ sentSprites }) {
    // printSprites(arguments[0], 'index shadow transition');

    sentSprites.forEach(sprite => {
      move(sprite, { easing: easeInAndOut, duration });
      resize(sprite, { easing: easeInAndOut, duration });
      opacity(sprite, { from: 0, easing: easeInAndOut, duration });
      sprite.applyStyles({
        'z-index': 3
      });
    });
  }
}
