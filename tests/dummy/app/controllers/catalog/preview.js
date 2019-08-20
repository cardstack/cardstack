import Controller from '@ember/controller';
import move from 'ember-animated/motions/move';
import scale from 'ember-animated/motions/scale';
import { parallel, printSprites, wait } from 'ember-animated';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';

export default class CatalogPreviewController extends Controller {
  @service boxel;

  preserveScrollPosition = true;

  transition = function*({ receivedSprites, sentSprites }) {
    try {
      printSprites(arguments[0]);

      receivedSprites.concat(sentSprites).forEach(sprite => {
        sprite.applyStyles({
          'z-index': 1
        });
      });

      receivedSprites.forEach(parallel(scale, move));
      sentSprites.forEach(parallel(scale, move));
    }

    catch (err) {
      yield wait(500);
      throw new Error(err);
    }
  }

  @action
  editModel() {
    this.boxel.set('currentPlane', 'tools');

    this.transitionToRoute('tools.edit', this.model.constructor.modelName, this.model.id);
  }
}
