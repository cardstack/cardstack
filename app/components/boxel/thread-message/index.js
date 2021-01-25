import Component from '@glimmer/component';
import "./style.css";
import { reads } from 'macro-decorators';
import move from 'ember-animated/motions/move';
import { fadeIn } from 'ember-animated/motions/opacity';
import { parallel, wait } from 'ember-animated';
import { easeOut } from 'ember-animated/easings/cosine';
// import { printSprites } from 'ember-animated';

export default class ThreadMessageComponent extends Component {
  @reads('args.iconSize', 40) iconSize;

  * transition({ insertedSprites }) {
    // printSprites(arguments[0]);

    for (let [i, sprite] of [...insertedSprites].entries()) {
      if (i === 0) {
        fadeIn(sprite, { easing: easeOut, duration: 200 });
      } else {
        yield wait(800);
        sprite.startTranslatedBy(0, 30);
        parallel(fadeIn(sprite, { easing: easeOut, duration: 200 }), move(sprite, { easing: easeOut, duration: 200 }));
      }
    }
  }
}
