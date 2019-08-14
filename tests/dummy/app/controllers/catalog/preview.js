import Controller from '@ember/controller';
import move from 'ember-animated/motions/move';
import { parallel, printSprites, wait } from 'ember-animated';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { task } from 'ember-concurrency-decorators';

export default class CatalogPreviewController extends Controller {
  @service boxel;
  
  preserveScrollPosition = true;

  @task
  transition = function*({ receivedSprites, sentSprites }) {
    try {
      printSprites(arguments[0]);

      receivedSprites.concat(sentSprites).forEach(sprite => {
        sprite.applyStyles({
          'z-index': 1
        });
      });

      receivedSprites.forEach(parallel(move));
      sentSprites.forEach(parallel(move));
    }

    catch (err) {
      yield wait(500);
      throw new Error(err);
    }
  }

  @action
  editModel(modelType) {
    this.boxel.set('currentPlane', 'tools');

    this.transitionToRoute('tools.edit', modelType);
  }
}
