import Controller from '@ember/controller';
import { action } from '@ember/object';
import move from 'ember-animated/motions/move';
import resize from 'ember-animated/motions/resize';
import opacity from 'ember-animated/motions/opacity';
import adjustCSS from 'ember-animated/motions/adjust-css';
import { easeOut, easeIn } from 'ember-animated/easings/cosine';
import { duration } from './index';

export default class DemoImageCardsImageCardController extends Controller {
  @action toggle() {
    this.transitionToRoute('demo.image-cards');
  }

  * transition ({ sentSprites }) {
    sentSprites.forEach(sprite => {
      move(sprite, { easing: easeOut, duration });
      resize(sprite, { easing: easeOut, duration });
      adjustCSS('border-radius', sprite, { easing: easeOut, duration: duration * 0.6 });
      sprite.applyStyles({ 'z-index': '2', 'background-color': 'white' });
    });
  }

  * imageTransition({ sentSprites }) {
    sentSprites.forEach(sprite => {
      move(sprite, { easing: easeOut, duration });
      resize(sprite, { easing: easeOut, duration });
      adjustCSS('border-top-left-radius', sprite, { easing: easeIn, duration });
      adjustCSS('border-top-right-radius', sprite, { easing: easeIn, duration });
      adjustCSS('border-bottom-left-radius', sprite, { easing: easeIn, duration });
      adjustCSS('border-bottom-right-radius', sprite, { easing: easeIn, duration });
      sprite.applyStyles({ 'z-index': '3'});
    });
  }

  * headerTransition({ sentSprites }) {
    sentSprites.forEach(sprite => {
      move(sprite, { easing: easeOut, duration });
      resize(sprite, { easing: easeOut, duration });
      opacity(sprite, { to: 0, easing: easeOut, duration });
      sprite.applyStyles({ 'z-index': '3' });
    });
  }
}
