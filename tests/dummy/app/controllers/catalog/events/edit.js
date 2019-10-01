import Controller from '@ember/controller';
import { action, set } from '@ember/object';
import resize from 'ember-animated/motions/resize';
import move from 'ember-animated/motions/move';
// import adjustCSS from 'ember-animated/motions/adjust-css';
// import { default as opacity } from 'ember-animated/motions/opacity';
import { printSprites } from 'ember-animated';

export default class CatalogEventsEditController extends Controller {
  @action
  viewGridPage() {
    set(this.model, 'selected', true);
    this.transitionToRoute('catalog.events');
  }

  * trayAnimation({ receivedSprites, sentSprites }) {
    printSprites(arguments[0], 'edit tray');

    receivedSprites.forEach(sprite => {
      move(sprite);
      resize(sprite);
      sprite.applyStyles({ 'z-index': 1 });
    });

    sentSprites.forEach(sprite => {
      move(sprite);
      resize(sprite);
      sprite.applyStyles({ 'z-index': 1 });
    });
  }
}
