import Controller from '@ember/controller';
import { action } from '@ember/object';
import resize from 'ember-animated/motions/resize';
import adjustCSS from 'ember-animated/motions/adjust-css';
import { printSprites } from 'ember-animated';
import { easeInAndOut } from 'ember-animated/easings/cosine';
import fade from 'ember-animated/transitions/fade';
import { fadeIn, fadeOut } from 'ember-animated/motions/opacity';
import move from 'ember-animated/motions/move';

export default class DemoAnimateInputController extends Controller {
  mode = 'view';
  fade = fade;

  @action setMode(mode) {
    this.model.set('mode', mode);
  }

  * headerTransition ({ keptSprites }) {
    printSprites(arguments[0], 'headerTransition');

    keptSprites.forEach(sprite => {
      resize(sprite, { easing: easeInAndOut });
    });
  }

  * transition (context) {
    let { insertedSprites, removedSprites } = context;
    let insertedSprite = insertedSprites[0];

    insertedSprites.forEach(sprite => {
      fadeIn(sprite);
    });
    removedSprites.forEach(sprite => {
      if (sprite.owner.id === "view") {
        sprite.endAtSprite(insertedSprite);
        // sprite.endAtPixel({
        //   x: insertedSprite.absoluteFinalBounds.left,
        //   y: insertedSprite.absoluteFinalBounds.top
        // });
        adjustCSS('font-size', sprite);
        move(sprite);
        // resize(sprite);
      }
      else {
        fadeOut(sprite);
      }
    });
  }
}
