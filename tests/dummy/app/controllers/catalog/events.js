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
        set(card, 'selected', !card.selected);
      }
      else {
        set(card, 'selected', false);
      }
    }
  }

  * trayAnimation({ keptSprites }) {
    // printSprites(arguments[0]);
    keptSprites.forEach(sprite => {
      move(sprite);
      resize(sprite);
      sprite.applyStyles({ 'z-index': 1 }); // in case it's overlapping other content
    });
  }

  * holdContent({ keptSprites }) {
    // printSprites(arguments[0]);
    keptSprites.forEach(sprite => {
      move(sprite);
    });
  }
}
