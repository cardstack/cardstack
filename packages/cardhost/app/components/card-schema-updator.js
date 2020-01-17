import CardManipulator from './card-manipulator';
import resize from 'ember-animated/motions/resize';
import move from 'ember-animated/motions/move';
import adjustCSS from 'ember-animated/motions/adjust-css';
import { printSprites } from 'ember-animated';
// import { easeInAndOut } from 'ember-animated/easings/cosine';
// import { remove } from 'lodash';

export default class CardSchemaUpdator extends CardManipulator {
  *cardTransition({ sentSprites, receivedSprites }) {
    printSprites(arguments[0], 'card schema transition');
    sentSprites.concat(receivedSprites).forEach(sprite => {
      move(sprite);
      resize(sprite);
      adjustCSS('padding', sprite);
      adjustCSS('border-radius', sprite);
      sprite.applyStyles({ 'z-index': '2' });
    });
  }
}
