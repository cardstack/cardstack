import Controller from '@ember/controller';
import { action, set } from '@ember/object';
import { inject as service } from '@ember/service';
import { filterBy } from '@ember/object/computed';

// import { printSprites } from 'ember-animated';
import move from 'ember-animated/motions/move';
import opacity from 'ember-animated/motions/opacity';
import scale from '../../../motions/scale';
import keep from '../../../motions/keep';
import resize from 'ember-animated/motions/resize';
import adjustCSS from 'ember-animated/motions/adjust-css';
import { easeInAndOut } from 'ember-animated/easings/cosine';

export let duration = 1000;

export default class DemoFormCardsIndexController extends Controller {
  @service boxel;

  @filterBy('model', 'expanded', true) expandedCards;

  @action edit(card) {
    for (let elt of this.model) {
      if (elt.id === card.id) {
        set(elt, 'selected', true);
        set(elt, 'expanded', true);
        this.boxel.moveBoxelToPlane(`boxel-${card.id}`, 'tools');
        this.transitionToRoute('form-cards.edit', card);
      } else {
        set(elt, 'selected', false);
        set(elt, 'expanded', false);
      }
    }
  }

  * wait ({ removedSprites }) {
    // printSprites(arguments[0], 'index wait');

    removedSprites.forEach(sprite => {
      keep(sprite);
    });
  }

  * backgroundTransition({ removedSprites, insertedSprites }) {
    // printSprites(arguments[0], 'index layerAway');

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

    insertedSprites.forEach(sprite => {
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

  * boxTransition({ sentSprites }) {
    // printSprites(arguments[0], 'index transition');

    sentSprites.forEach(sprite => {
      move(sprite, { easing: easeInAndOut, duration });
      resize(sprite, { easing: easeInAndOut, duration });
      adjustCSS('opacity', sprite, { easing: easeInAndOut, duration });
      sprite.applyStyles({ 'z-index': 3 });
    });
  }
}
