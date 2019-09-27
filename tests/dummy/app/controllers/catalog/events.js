import Controller from '@ember/controller';
import { action, set } from '@ember/object';
import resize from 'ember-animated/motions/resize';
import move from 'ember-animated/motions/move';
import adjustCSS from 'ember-animated/motions/adjust-css';
import { default as opacity } from 'ember-animated/motions/opacity';
import { printSprites, wait } from 'ember-animated';

export let animationDelay = 350;
export let highlightDuration = 150;

export default class CatalogEventsController extends Controller {
  @action
  select(id) {
    for (let card of this.model) {
      if (card.id === id) {
        set(card, 'selected', true);
      }
      else {
        set(card, 'selected', false);
      }
    }
  }

  @action
  unselect(id) {
    for (let card of this.model) {
      if (card.id === id) {
        set(card, 'selected', false);
      }
    }
  }

  @action
  viewDetailPage(card) {
    set(card, 'selected', false);
    this.transitionToRoute('events.view', card);
  }

  * trayAnimation({ keptSprites, receivedSprites }) {
    // printSprites(arguments[0], 'events tray animation');

    if (keptSprites.length) {
      yield wait(animationDelay);
    }

    keptSprites.forEach(sprite => {
      move(sprite, { duration: highlightDuration });
      resize(sprite, { duration: highlightDuration });
      sprite.applyStyles({ 'z-index': 1 }); // in case it's overlapping other content
    });

    receivedSprites.forEach(sprite => {
      move(sprite);
      resize(sprite);
      opacity(sprite, { from: 0 });
      sprite.applyStyles({ 'z-index': 1 });
    });
  }

  * holdContent({ keptSprites }) {
    // printSprites(arguments[0], 'events content');

    if (keptSprites.length) {
      yield wait(animationDelay);
    }

    keptSprites.forEach(sprite => {
      move(sprite, { duration: highlightDuration });
      sprite.applyStyles({ 'z-index': 1 });
    });
  }

  * imageTransition({ sentSprites }) {
    // printSprites(arguments[0], 'events image transition');

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
      sprite.applyStyles({ 'z-index': 4 });
    });
  }
}
