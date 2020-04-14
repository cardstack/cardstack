import Controller from '@ember/controller';
import { action, set } from '@ember/object';
import { filterBy } from '@ember/object/computed';
import move from 'ember-animated/motions/move';
import resize from 'ember-animated/motions/resize';
import adjustCSS from 'ember-animated/motions/adjust-css';
import { easeOut } from 'ember-animated/easings/cosine';
import { default as opacity } from 'ember-animated/motions/opacity';

export default class CardsController extends Controller {
  @filterBy('model', 'expanded', true) expandedCards;

  @action toggle(id) {
    for (let elt of this.model) {
      if (elt.id === id) {
        set(elt, 'expanded', !elt.expanded);
      } else {
        set(elt, 'expanded', false);
      }
    }
  }

  * cardTransition ({ keptSprites }) {
    keptSprites.forEach(sprite => {
      move(sprite, { easing: easeOut });
      resize(sprite, { easing: easeOut });
      opacity(sprite, { easing: easeOut });
      adjustCSS('border-radius', sprite, { easing: easeOut });
      adjustCSS('padding', sprite, { easing: easeOut });
    });
  }

  * titleTransition ({ keptSprites }) {
    keptSprites.forEach(sprite => {
      move(sprite, { easing: easeOut });
      resize(sprite, { easing: easeOut });
      opacity(sprite, { easing: easeOut });
      adjustCSS('font-size', sprite, { easing: easeOut });
    });
  }
}
