import Controller from '@ember/controller';
import { action, set } from '@ember/object';
import move from 'ember-animated/motions/move';
import resize from 'ember-animated/motions/resize';
import adjustCSS from 'ember-animated/motions/adjust-css';
import { printSprites } from 'ember-animated';
import { easeOut } from 'ember-animated/easings/cosine';

export default class CardsController extends Controller {
  @action toggle(id) {
    for (let elt of this.model) {
      if (elt.id === id) {
        set(elt, 'expanded', !elt.expanded);
        set(elt, 'faded', false);
      } else {
        set(elt, 'expanded', false);
        set(elt, 'faded', !elt.faded);
      }
    }
  }

  * transition ({ keptSprites }) {
    printSprites(arguments[0]);
    keptSprites.forEach(sprite => {
      move(sprite, { easing: easeOut });
      resize(sprite, { easing: easeOut });
      adjustCSS('border-radius', sprite, { easing: easeOut });
      adjustCSS('opacity', sprite, { easing: easeOut });
    });
  }
}
