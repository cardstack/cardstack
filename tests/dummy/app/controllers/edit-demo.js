import Controller from '@ember/controller';
import { action } from '@ember/object';
import resize from 'ember-animated/motions/resize';
import adjustCSS from 'ember-animated/motions/adjust-css';
import adjustColor from 'ember-animated/motions/adjust-color';
import { printSprites } from 'ember-animated';
import { easeInAndOut } from 'ember-animated/easings/cosine';
import fade from 'ember-animated/transitions/fade';

export default class EditDemoController extends Controller {
  mode = 'view';
  fade = fade;

  @action setMode(mode) {
    this.model.set('mode', mode);
  }


  * trayTransition ({ keptSprites }) {
    printSprites(arguments[0], 'trayTransition');
    keptSprites.forEach(sprite => {
      adjustColor('background-color', sprite, { easing: easeInAndOut });
    });
  }

  * cardTransition ({ keptSprites }) {
    printSprites(arguments[0], 'cardTransition');
    keptSprites.forEach(sprite => {
      resize(sprite, { easing: easeInAndOut });
      adjustColor('border-color', sprite, { easing: easeInAndOut });
      adjustCSS('border-radius', sprite, { easing: easeInAndOut });
    });
  }

  * headerTransition ({ keptSprites }) {
    printSprites(arguments[0], 'headerTransition');

    keptSprites.forEach(sprite => {
      resize(sprite, { easing: easeInAndOut });
      adjustColor('background-color', sprite, { easing: easeInAndOut });
      adjustCSS('border-top-left-radius', sprite, { easing: easeInAndOut });
      adjustCSS('border-top-right-radius', sprite, { easing: easeInAndOut });
    });
  }
  * bodyTransition ({ keptSprites }) {
    printSprites(arguments[0], 'bodyTransition');
    keptSprites.forEach(sprite => {
      resize(sprite, { easing: easeInAndOut });
      adjustColor('background-color', sprite, { easing: easeInAndOut });
      adjustCSS('border-bottom-left-radius', sprite, { easing: easeInAndOut });
      adjustCSS('border-bottom-right-radius', sprite, { easing: easeInAndOut });
    });
  }
}
