import Component from '@glimmer/component';
import move from 'ember-animated/motions/move';
import { fadeIn, fadeOut } from 'ember-animated/motions/opacity';
import { ResizeAfterDelay } from '../../../../motions/resize-after-delay';
import ENV from '@cardstack/cardhost/config/environment';

const { animationSpeed } = ENV;
const duration = 250;

export default class IsolatedComponent extends Component {
  resizeAfterDelay = ResizeAfterDelay;
  duration = animationSpeed || duration;

  *transition({ insertedSprites, keptSprites, removedSprites }) {
    if (insertedSprites.length) {
      removedSprites.forEach(fadeOut);
    } else {
      yield Promise.all(removedSprites.map(fadeOut));
    }
    yield Promise.all(keptSprites.map(move));
    insertedSprites.forEach(fadeIn);
  }
}
