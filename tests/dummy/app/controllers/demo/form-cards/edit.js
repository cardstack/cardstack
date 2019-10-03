import Controller from '@ember/controller';
import { action } from '@ember/object';

import { printSprites } from 'ember-animated';
import move from 'ember-animated/motions/move';
import resize from 'ember-animated/motions/resize';
import { easeInAndOut } from 'ember-animated/easings/cosine';
import boxShadow from 'ember-animated/motions/box-shadow';

import { duration } from './index';

export default class DemoFormCardsEditController extends Controller {
  @action backToList() {
    this.transitionToRoute('demo.form-cards');
  }

  * backgroundTransition ({ insertedSprites, removedSprites, receivedSprites }) {
    printSprites(arguments[0], 'edit background transition');

    insertedSprites.forEach(sprite => {
      sprite.startAtPixel({ y: -1.5 * window.innerHeight });
      move(sprite, { easing: easeInAndOut, duration });
      sprite.applyStyles({ 'z-index': 2 });
    });

    receivedSprites.forEach(sprite => {
      move(sprite, { easing: easeInAndOut, duration });
      sprite.applyStyles({ 'z-index': 2 });
    });


    removedSprites.forEach(sprite => {
      sprite.endAtPixel({ y: -1.5 * window.innerHeight });
      move(sprite, { easing: easeInAndOut, duration });
      sprite.applyStyles({ 'z-index': 2 });
    });
  }

  * boxTransition({ sentSprites, removedSprites, receivedSprites }) {
    // printSprites(arguments[0], 'edit box transition');

    sentSprites.forEach(sprite => {
      move(sprite, { easing: easeInAndOut, duration });
      resize(sprite, { easing: easeInAndOut, duration });
      boxShadow(sprite);
      sprite.applyStyles({
        'z-index': 3
      });
    });

    receivedSprites.forEach(sprite => {
      move(sprite, { easing: easeInAndOut, duration });
      resize(sprite, { easing: easeInAndOut, duration });
      boxShadow(sprite);
      sprite.applyStyles({
        'z-index': 3
      });
    });

    removedSprites.forEach(sprite => {
      sprite.endAtPixel({
        x: sprite.initialBounds.left,
        y: sprite.initialBounds.top
      });
      move(sprite, { easing: easeInAndOut, duration });
      sprite.applyStyles({
        'z-index': 1
      });
    });
  }
}
