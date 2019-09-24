import Controller from '@ember/controller';
import { action, set } from '@ember/object';
import resize from 'ember-animated/motions/resize';
import move from 'ember-animated/motions/move';
import adjustCSS from 'ember-animated/motions/adjust-css';
import { printSprites, wait } from 'ember-animated';

import { animationDelay } from '../catalog/events';
import { duration } from '../catalog/events';

export default class EventsViewController extends Controller {
  duration = duration;

  @action
  select() {
    set(this.model, 'selected', true);
  }

  @action
  unselect() {
    set(this.model, 'selected', false);
  }

  @action
  viewGridPage() {
    this.transitionToRoute('catalog.events');
  }

  * trayAnimation({ keptSprites, duration }) {
    printSprites(arguments[0], 'view tray animation');

    yield wait(animationDelay);

    keptSprites.forEach(sprite => {
      move(sprite, { duration });
      resize(sprite, { duration });
      sprite.applyStyles({ 'z-index': 1 }); // in case it's overlapping other content
    });
  }

  * holdContent({ keptSprites, duration }) {
    // printSprites(arguments[0], 'view content');

    yield wait(animationDelay);

    keptSprites.forEach(sprite => {
      move(sprite, { duration });
    });
  }

  * cardTransition({ sentSprites }) {
    sentSprites.forEach(sprite => {
      move(sprite);
      resize(sprite);
      sprite.applyStyles({ 'z-index': 2 });
    });
  }

  * imageTransition({ sentSprites }) {
    // printSprites(arguments[0], 'view image transition');

    sentSprites.forEach(sprite => {
      move(sprite);
      resize(sprite);
      sprite.applyStyles({ 'z-index': 3 });
    });
  }

  * headerTransition({ sentSprites }) {
    sentSprites.forEach(sprite => {
      move(sprite);
      sprite.applyStyles({ 'z-index': 3 });
    });
  }

  * tweenTitle({ sentSprites }) {
    sentSprites.forEach(sprite => {
      move(sprite);
      resize(sprite);
      adjustCSS('font-size', sprite);
      adjustCSS('line-height', sprite);
      sprite.applyStyles({ 'z-index': 4 });
    })
  }
}
