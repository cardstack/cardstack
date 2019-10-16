import Controller from '@ember/controller';
import { action } from '@ember/object';
import scale from 'ember-animated/motions/scale';
import move from 'ember-animated/motions/move';
import { default as opacity } from 'ember-animated/motions/opacity';
import { printSprites, parallel } from 'ember-animated';

export default class CatalogCreateNewController extends Controller {
  @action
  toggleDetailView(field) {
    this.toggleProperty('displayDetailView');

    if (this.displayDetailView) {
      this.set('selectedField', field);
    }
    else {
      this.set('selectedField', null);
    }
  }

  @action
  hideDetailView() {
    this.set('displayDetailView', false);
    this.set('selectedField', null);
  }

  * transition ({ insertedSprites, removedSprites, beacons }) {
    printSprites(arguments[0]);

    insertedSprites.forEach(sprite => {
      sprite.startAtSprite(beacons.field);
      parallel(move(sprite, scale(sprite)));
      sprite.applyStyles({ 'z-index': 3 });
    });

    removedSprites.forEach(sprite => {
      sprite.endAtSprite(beacons.field);
      parallel(move(sprite, scale(sprite)));
      sprite.applyStyles({ 'z-index': 3 });
    });
  }

  * backgroundTransition ({ insertedSprites, removedSprites }) {
    printSprites(arguments[0]);

    insertedSprites.forEach(sprite => {
      opacity(sprite, { from: 0.1 });
    });

    removedSprites.forEach(sprite => {
      opacity(sprite, { to: 0.1 });
    });
  }
}
