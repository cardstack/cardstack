import Controller from '@ember/controller';
import { action, set } from '@ember/object';
import resize from 'ember-animated/motions/resize';
import move from 'ember-animated/motions/move';
import adjustCSS from 'ember-animated/motions/adjust-css';
import { printSprites, wait } from 'ember-animated';

export let animationDelay = 350;
export let highlightDuration = 150;

export default class CatalogEventsV2IndexController extends Controller {
  // TODO: Do not do select/unselect actions while other animation is running
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
    this.transitionToRoute('events-v2.view', card);
  }

  @action
  viewEditPage(card) {
    this.transitionToRoute('catalog.events-v2.edit', card);
  }

  * trayAnimation({ keptSprites, receivedSprites, sentSprites }) {
    printSprites(arguments[0], 'index tray animation');

    if (keptSprites.length) {
      yield wait(animationDelay);
    }

    keptSprites.forEach(sprite => {
      move(sprite, { duration: highlightDuration });
      resize(sprite, { duration: highlightDuration });
    });

    sentSprites.forEach(sprite => {
      move(sprite);
      resize(sprite);
      sprite.applyStyles({ 'z-index': 1 });
    });

    receivedSprites.forEach(sprite => {
      move(sprite);
      resize(sprite);
      sprite.applyStyles({ 'z-index': 1 });
    });
  }

  * imageTransition({ sentSprites }) {
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

  * titleTransition({ sentSprites }) {
    sentSprites.forEach(sprite => {
      move(sprite);
      resize(sprite);
      adjustCSS('font-size', sprite);
      sprite.applyStyles({ 'z-index': 4 });
    });
  }
}
