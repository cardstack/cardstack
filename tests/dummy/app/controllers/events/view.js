import Controller from '@ember/controller';
import { action, set } from '@ember/object';
import resize from 'ember-animated/motions/resize';
import move from 'ember-animated/motions/move';
import adjustCSS from 'ember-animated/motions/adjust-css';
import { default as opacity } from 'ember-animated/motions/opacity';
import { wait } from 'ember-animated';

import { animationDelay } from '../catalog/events';
import { highlightDuration } from '../catalog/events';

export default class CatalogEventsViewController extends Controller {
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
    set(this.model, 'selected', true);
    this.transitionToRoute('catalog.events');
  }

  * trayAnimation({ keptSprites, receivedSprites }) {
    if (keptSprites.length) {
      yield wait(animationDelay);
    }

    keptSprites.forEach(sprite => {
      move(sprite, { duration: highlightDuration });
      resize(sprite, { duration: highlightDuration });
      sprite.applyStyles({ 'z-index': '1' }); // in case it's overlapping other content
    });

    // This element moves the card
    receivedSprites.forEach(sprite => {
      move(sprite);
      resize(sprite);
      sprite.applyStyles({ 'z-index': '1' });
    });
  }

  * holdContent({ keptSprites, receivedSprites }) {
    if (keptSprites.length) {
      yield wait(animationDelay);
    }

    keptSprites.forEach(sprite => {
      move(sprite, { duration: highlightDuration });
      sprite.applyStyles({ 'z-index': '1' });
    });

    // Need `moveToFinalPosition` to adjust for overshooting
    receivedSprites.forEach(sprite => {
      sprite.moveToFinalPosition();
      resize(sprite);
      sprite.applyStyles({ 'z-index': '1' });
    });
  }

  * cardTransition({ sentSprites, receivedSprites }) {
    sentSprites.forEach(sprite => {
      move(sprite);
      resize(sprite);
      sprite.applyStyles({ 'z-index': '2' });
    });

    receivedSprites.forEach(sprite => {
      sprite.moveToFinalPosition();
      resize(sprite);
      sprite.applyStyles({ 'z-index': '2' });
    });
  }

  * imageTransition({ sentSprites }) {
    sentSprites.forEach(sprite => {
      move(sprite);
      resize(sprite);
      sprite.applyStyles({ 'z-index': '3' });
    });
  }

  * headerTransition({ sentSprites }) {
    sentSprites.forEach(sprite => {
      move(sprite);
      sprite.applyStyles({ 'z-index': '3' });
    });
  }

  * bodyTransition({ sentSprites, receivedSprites, duration }) {
    sentSprites.forEach(sprite => {
      move(sprite);
      resize(sprite);
      opacity(sprite, { to: 0,  duration: duration / 2 });
      sprite.applyStyles({ 'z-index': '4' });
    });

    receivedSprites.forEach(sprite => {
      sprite.moveToFinalPosition();
      resize(sprite);
      opacity(sprite, { from: 0 });
      sprite.applyStyles({ 'z-index': '4' });
    });
  }

  * tweenTitle({ sentSprites }) {
    sentSprites.forEach(sprite => {
      move(sprite);
      resize(sprite);
      adjustCSS('font-size', sprite);
      sprite.applyStyles({ 'z-index': '4' });
    })
  }
}
