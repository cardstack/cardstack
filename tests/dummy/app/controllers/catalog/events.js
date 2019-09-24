import Controller from '@ember/controller';
import { action, set } from '@ember/object';
import resize from 'ember-animated/motions/resize';
import move from 'ember-animated/motions/move';
// import { printSprites } from 'ember-animated';

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
  viewDetailPage(id) {
    this.transitionToRoute('events.view', id);
  }

  * trayAnimation({ keptSprites }) {
    // printSprites(arguments[0], 'events tray animation');

    keptSprites.forEach(sprite => {
      move(sprite);
      resize(sprite);
      sprite.applyStyles({ 'z-index': 1 }); // in case it's overlapping other content
    });
  }

  * holdContent({ keptSprites }) {
    // printSprites(arguments[0], 'events content');

    keptSprites.forEach(sprite => {
      move(sprite);
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
      resize(sprite);
      sprite.applyStyles({ 'z-index': 3 });
    });
  }
}
