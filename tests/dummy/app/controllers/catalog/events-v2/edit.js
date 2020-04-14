import Controller from '@ember/controller';
import { action, set } from '@ember/object';
import resize from 'ember-animated/motions/resize';
import move from 'ember-animated/motions/move';
import adjustCSS from 'ember-animated/motions/adjust-css';
import { default as opacity } from 'ember-animated/motions/opacity';

export default class CatalogEventsV2EditController extends Controller {
  @action
  viewGridPage() {
    set(this.model, 'selected', true);
    this.transitionToRoute('catalog.events-v2');
  }

  * cardTransition({ sentSprites, receivedSprites }) {
    sentSprites.forEach(sprite => {
      move(sprite);
      resize(sprite);
      adjustCSS('padding', sprite);
      adjustCSS('border-radius', sprite);
      sprite.applyStyles({ 'z-index': '2' });
    });

    receivedSprites.forEach(sprite => {
      move(sprite);
      resize(sprite);
      adjustCSS('padding', sprite);
      adjustCSS('border-radius', sprite);
      sprite.applyStyles({ 'z-index': '2' });
    });
  }

  * imageTransition({ sentSprites }) {
    sentSprites.forEach(sprite => {
      move(sprite);
      resize(sprite);
      adjustCSS('border-top-right-radius', sprite);
      adjustCSS('border-top-left-radius', sprite);
      sprite.applyStyles({ 'z-index': '3' });
    });
  }

  * headerTransition({ sentSprites }) {
    sentSprites.forEach(sprite => {
      move(sprite);
      sprite.applyStyles({ 'z-index': '3' });
    });
  }

  * titleTransition({ sentSprites }) {
    sentSprites.forEach(sprite => {
      move(sprite);
      resize(sprite);
      adjustCSS('font-size', sprite);
      sprite.applyStyles({ 'z-index': '4' });
    })
  }

  * bodyTransition({ sentSprites, receivedSprites, duration }) {
    sentSprites.forEach(sprite => {
      move(sprite);
      resize(sprite);
      opacity(sprite, { to: 0,  duration: duration / 2 });
      sprite.applyStyles({ 'z-index': '3' });
    });

    receivedSprites.forEach(sprite => {
      sprite.moveToFinalPosition();
      resize(sprite);
      opacity(sprite, { from: 0 });
      sprite.applyStyles({ 'z-index': '3' });
    });
  }
}
