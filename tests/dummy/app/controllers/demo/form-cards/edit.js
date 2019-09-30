import Controller from '@ember/controller';
import { action, set } from '@ember/object';
import { inject as service } from '@ember/service';

// import { printSprites } from 'ember-animated';
import move from 'ember-animated/motions/move';
import resize from 'ember-animated/motions/resize';
import adjustCSS from 'ember-animated/motions/adjust-css';
import { easeInAndOut } from 'ember-animated/easings/cosine';
import { duration } from './index';

export default class DemoFormCardsEditController extends Controller {
  @service boxel;

  @action backToList() {
    set(this.model, 'expanded', false);
    set(this.model, 'selected', false);
    this.boxel.moveBoxelToPlane(`boxel-${this.model.id}`, 'space');
    this.transitionToRoute('form-cards');
  }

  * backgroundTransition ({ insertedSprites, removedSprites }) {
    // printSprites(arguments[0], 'edit background');

    insertedSprites.forEach(function(sprite) {
      sprite.startAtPixel({ y: -1.5 * window.innerHeight });
      move(sprite, { easing: easeInAndOut, duration });
      sprite.applyStyles({ 'z-index': 2 });
    });

    removedSprites.forEach(sprite => {
      sprite.endAtPixel({ y: -1.5 * window.innerHeight })
      move(sprite, { easing: easeInAndOut, duration });
      sprite.applyStyles({ 'z-index': 2 });
    });
  }

  * boxTransition({ sentSprites }) {
    // printSprites(arguments[0], 'edit transition');

    sentSprites.forEach(sprite => {
      move(sprite, { easing: easeInAndOut, duration });
      resize(sprite, { easing: easeInAndOut, duration });
      adjustCSS('opacity', sprite, { easing: easeInAndOut, duration });
      sprite.applyStyles({ 'z-index': 3 });
    });
  }
}
