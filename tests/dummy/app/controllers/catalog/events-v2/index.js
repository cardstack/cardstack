import Controller from '@ember/controller';
import { action, set } from '@ember/object';
import resize from 'ember-animated/motions/resize';
import move from 'ember-animated/motions/move';
import adjustCSS from 'ember-animated/motions/adjust-css';
import { wait } from 'ember-animated';

export let animationDelay = 350;
export let highlightDuration = 150;

export default class CatalogEventsV2IndexController extends Controller {
  // TODO: Do not do select/unselect actions while other animation is running
  @action
  select(id) {
    for (let card of this.model.content) {
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
    for (let card of this.model.content) {
      if (card.id === id) {
        set(card, 'selected', false);
      }
    }
  }

  @action
  viewDetailPage(card) {
    this.transitionToRoute('catalog.events-v2.view', card);
  }

  @action
  viewEditPage(card) {
    this.transitionToRoute('catalog.events-v2.edit', card);
  }

  * trayAnimation({ keptSprites, receivedSprites, sentSprites }) {
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
      sprite.applyStyles({ 'z-index': '1' });
    });

    receivedSprites.forEach(sprite => {
      move(sprite);
      resize(sprite);
      sprite.applyStyles({ 'z-index': '1' });
    });
  }

  * cardTransition({ receivedSprites }) {
    receivedSprites.forEach(sprite => {
      sprite.moveToFinalPosition();
      sprite.applyStyles({ 'z-index': '3' });
    });
  }

  * imageTransition({ sentSprites, receivedSprites }) {
    sentSprites.forEach(sprite => {
      move(sprite);
      resize(sprite);
      adjustCSS('border-top-right-radius', sprite);
      adjustCSS('border-top-left-radius', sprite);
      sprite.applyStyles({ 'z-index': '3' });
    });

    receivedSprites.forEach(sprite => {
      sprite.moveToFinalPosition();
      sprite.applyStyles({ 'z-index': '4' });
    });
  }

  * headerTransition({ sentSprites, receivedSprites }) {
    sentSprites.forEach(sprite => {
      move(sprite);
      sprite.applyStyles({ 'z-index': '3' });
    });

    receivedSprites.forEach(sprite => {
      sprite.moveToFinalPosition();
      sprite.applyStyles({ 'z-index': '4' });
    });
  }

  * titleTransition({ sentSprites, receivedSprites }) {
    sentSprites.forEach(sprite => {
      move(sprite);
      resize(sprite);
      adjustCSS('font-size', sprite);
      sprite.applyStyles({ 'z-index': '4' });
    });

    receivedSprites.forEach(sprite => {
      sprite.moveToFinalPosition();
      sprite.applyStyles({ 'z-index': '5' });
    });
  }
}
