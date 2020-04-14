import Controller from '@ember/controller';
import { action } from '@ember/object';
import move from 'ember-animated/motions/move';
import resize from 'ember-animated/motions/resize';
import opacity from 'ember-animated/motions/opacity';
import adjustCSS from 'ember-animated/motions/adjust-css';
import { easeOut } from 'ember-animated/easings/cosine';

export let duration = 700;

export default class DemoImageCardsIndexController extends Controller {

  @action toggle(card) {
    this.transitionToRoute('demo.image-cards.image-card', card);
  }

  * transition({ sentSprites }) {
    sentSprites.forEach(sprite => {
      move(sprite, { easing: easeOut, duration });
      resize(sprite, { easing: easeOut, duration });
      adjustCSS('border-radius', sprite, { easing: easeOut, duration });
      sprite.applyStyles({ 'background-color': 'transparent' });
    });
  }

  * imageTransition({ sentSprites }) {
    sentSprites.forEach(sprite => {
      move(sprite, { easing: easeOut, duration });
      resize(sprite, { easing: easeOut, duration });
      adjustCSS('border-top-left-radius', sprite, { easing: easeOut, duration });
      adjustCSS('border-top-right-radius', sprite, { easing: easeOut, duration });
      adjustCSS('border-bottom-left-radius', sprite, { easing: easeOut, duration: duration * 0.4 });
      adjustCSS('border-bottom-right-radius', sprite, { easing: easeOut, duration: duration * 0.4 });
      sprite.applyStyles({ 'z-index': '1' });
    });
  }

  * headerTransition({ sentSprites }) {
    sentSprites.forEach(sprite => {
      move(sprite, { easing: easeOut, duration });
      resize(sprite, { easing: easeOut, duration });
      opacity(sprite, { from: 0, easing: easeOut, duration });
      sprite.applyStyles({ 'z-index': '1' });
    });
  }
}
