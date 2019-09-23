import Controller from '@ember/controller';
import { action, set } from '@ember/object';
import resize from 'ember-animated/motions/resize';
import move from 'ember-animated/motions/move';
// import { printSprites } from 'ember-animated';

export default class EventsViewController extends Controller {
  @action
  select() {
    set(this.model, 'selected', !this.model.selected);
  }

  @action
  viewGridPage() {
    set(this.model, 'selected', false);
    this.transitionToRoute('catalog.events');
  }

  * trayAnimation({ keptSprites }) {
    // printSprites(arguments[0], 'view tray animation');

    keptSprites.forEach(sprite => {
      move(sprite);
      resize(sprite);
      sprite.applyStyles({ 'z-index': 1 }); // in case it's overlapping other content
    });
  }

  * holdContent({ keptSprites }) {
    // printSprites(arguments[0], 'view content');

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
    // printSprites(arguments[0], 'view image transition');

    sentSprites.forEach(sprite => {
      move(sprite);
      resize(sprite);
      sprite.applyStyles({ 'z-index': 3 });
    });
  }

  * headerTransition({ sentSprites }) {
    // printSprites(arguments[0], 'view image transition');

    sentSprites.forEach(sprite => {
      move(sprite);
      resize(sprite);
      sprite.applyStyles({ 'z-index': 3 });
    });
  }
}
