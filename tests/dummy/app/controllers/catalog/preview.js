import Controller from '@ember/controller';
import move from 'ember-animated/motions/move';
import { parallel, printSprites, wait } from 'ember-animated';

export default Controller.extend({
  preserveScrollPosition: true,

  transition: function * ({ receivedSprites, sentSprites }) {
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
});
