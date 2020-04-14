import Controller from '@ember/controller';
import { action } from '@ember/object';
import move from 'ember-animated/motions/move';
import opacity from 'ember-animated/motions/opacity';
import scale from 'ember-animated/motions/scale';
import { easeInAndOut } from 'ember-animated/easings/cosine';

import keep from '../../../motions/keep';
import scaleBy from '../../../motions/scale';

export let duration = 600;

export default class DemoFormCardsIndexController extends Controller {
  @action edit(card) {
    this.transitionToRoute('demo.form-cards.edit', card.id);
  }

  * wait({ removedSprites, receivedSprites }) {
    removedSprites.concat(receivedSprites).forEach(keep);
  }

  * backgroundTransition({ removedSprites, insertedSprites, sentSprites }) {
    let factor = 0.8;

    removedSprites.forEach(sprite => {
      sprite.endAtPixel({
        x: sprite.initialBounds.left + ((1 - factor) / 2 * sprite.initialBounds.width),
        y: sprite.initialBounds.top + ((1 - factor) / 2 * sprite.initialBounds.height)
      });
      opacity(sprite, { to: 0, easing: easeInAndOut, duration });
      scaleBy(sprite, { by: factor, easing: easeInAndOut, duration });
      move(sprite, { easing: easeInAndOut, duration });
      sprite.applyStyles({ 'z-index': '1' });
    });

    insertedSprites.forEach(sprite => {
      sprite.startAtPixel({
        x: sprite.finalBounds.left + ((1 - factor) / 2 * sprite.finalBounds.width),
        y: sprite.finalBounds.top + ((1 - factor) / 2 * sprite.finalBounds.height)
      });
      sprite.scale(factor, factor);
      opacity(sprite, { from: 0, easing: easeInAndOut, duration });
      scaleBy(sprite, { by: 1 / factor, easing: easeInAndOut, duration });
      move(sprite, { easing: easeInAndOut, duration });
      sprite.applyStyles({ 'z-index': '1' });
    });

    sentSprites.forEach(sprite => {
      opacity(sprite, { easing: easeInAndOut, duration });
      scale(sprite, { easing: easeInAndOut, duration });
      move(sprite, { disableMomentum: true, easing: easeInAndOut, duration });
    });
  }
}
