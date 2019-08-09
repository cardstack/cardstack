import Controller from '@ember/controller';
import move, { continuePrior } from 'ember-animated/motions/move';
import scale from 'ember-animated/motions/scale';
import opacity from 'ember-animated/motions/opacity';
import { parallel, printSprites, wait } from 'ember-animated';

export default Controller.extend({
  preserveScrollPosition: true,

  transition: function * ({ receivedSprites, sentSprites, removedSprites, insertedSprites }) {
    try {
      printSprites(arguments[0]);

      receivedSprites.concat(sentSprites).forEach(sprite => {
        sprite.applyStyles({
          'z-index': 1
        });
      });

      receivedSprites.forEach(parallel(move, scale));
      sentSprites.forEach(parallel(move, scale));

      removedSprites.forEach(sprite => {
        sprite.endTranslatedBy(0, 0);
        continuePrior(sprite);
        opacity(sprite, { to: 0 });
      });

      insertedSprites.forEach(sprite => {
        opacity(sprite, { from: 0, to: 1 });
      });
    }

    catch (err) {
      yield wait(500);
      throw new Error(err);
    }
  }
});
