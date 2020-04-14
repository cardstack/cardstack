import Controller from '@ember/controller';
import { action } from '@ember/object';
import move from 'ember-animated/motions/move';
import drag from '../../motions/drag';

export default class DemoDragDropAnimationController extends Controller {
  rightWell = [];

  @action beginDragging(card, direction, event) {
    let dragState;
    let self = this;

    function stopMouse() {
      if (direction === 'right') {
        self.set('leftWell', []);
        self.set('rightWell', [card]);
      } else {
        self.set('rightWell', []);
        self.set('leftWell', [card]);
      }

      card.set('dragState', null);
      window.removeEventListener('mouseup', stopMouse);
      window.removeEventListener('mousemove', updateMouse);
    }

    function updateMouse(event) {
      dragState.latestPointerX = event.x;
      dragState.latestPointerY = event.y;
    }

    dragState = {
      usingKeyboard: false,
      initialPointerX: event.x,
      initialPointerY: event.y,
      latestPointerX: event.x,
      latestPointerY: event.y
    };
    window.addEventListener('mouseup', stopMouse);
    window.addEventListener('mousemove', updateMouse);

    card.set('dragState', dragState);
  }

  * dragTransition ({ keptSprites, receivedSprites }) {
    keptSprites.forEach(sprite => {
      drag(sprite, { others: [] });
    });

    receivedSprites.forEach(move);
  }
}
