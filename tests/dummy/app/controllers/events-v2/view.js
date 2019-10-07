import Controller from '@ember/controller';
import { action, set } from '@ember/object';
import resize from 'ember-animated/motions/resize';
import move from 'ember-animated/motions/move';
import adjustCSS from 'ember-animated/motions/adjust-css';
import { default as opacity } from 'ember-animated/motions/opacity';
// import { printSprites } from 'ember-animated';

export default class EventsV2ViewController extends Controller {
  @action
  viewGridPage() {
    set(this.model, 'selected', true);
    this.transitionToRoute('catalog.events-v2');
  }

  * cardTransition({ sentSprites, receivedSprites, removedSprites }) {
    // printSprites(arguments[0], 'view - card transition');

    sentSprites.forEach(sprite => {
      move(sprite);
      resize(sprite);
      sprite.applyStyles({ 'z-index': 2 });
    });

    receivedSprites.forEach(sprite => {
      move(sprite);
      resize(sprite);
      sprite.applyStyles({ 'z-index': 2 });
    });

    removedSprites.forEach(sprite => {
      sprite.hide();
    });
  }

  * imageTransition({ sentSprites, removedSprites }) {
    // printSprites(arguments[0], 'view image transition');

    sentSprites.forEach(sprite => {
      move(sprite);
      resize(sprite);
      sprite.applyStyles({ 'z-index': 3 });
    });

    removedSprites.forEach(sprite => {
      sprite.hide();
    });
  }

  * headerTransition({ sentSprites, removedSprites }) {
    sentSprites.forEach(sprite => {
      move(sprite);
      sprite.applyStyles({ 'z-index': 3 });
    });

    removedSprites.forEach(sprite => {
      sprite.hide();
    });
  }

  * titleTransition({ sentSprites, removedSprites }) {
    sentSprites.forEach(sprite => {
      move(sprite);
      resize(sprite);
      adjustCSS('font-size', sprite);
      sprite.applyStyles({ 'z-index': 4 });
    });

    removedSprites.forEach(sprite => {
      sprite.hide();
    });
  }

  * bodyTransition({ sentSprites, receivedSprites, removedSprites, duration }) {
    // printSprites(arguments[0], 'view body transition');

    sentSprites.forEach(sprite => {
      move(sprite);
      resize(sprite);
      opacity(sprite, { to: 0,  duration: duration / 2 });
      sprite.applyStyles({ 'z-index': 3 });
    });

    receivedSprites.forEach(sprite => {
      sprite.moveToFinalPosition();
      // move(sprite);
      resize(sprite);
      opacity(sprite, { from: 0 });
      sprite.applyStyles({ 'z-index': 3 });
    });

    removedSprites.forEach(sprite => {
      sprite.hide();
    });
  }
}
