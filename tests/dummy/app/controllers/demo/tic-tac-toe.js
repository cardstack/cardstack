import Controller from '@ember/controller';
import { action, set } from '@ember/object';
import move from 'ember-animated/motions/move';
import drag from '../../motions/drag';

export default class DemoTicTacToeController extends Controller {
  ticTacToeCells = {
    topLeft: [],
    topCenter: [],
    topRight: [],
    middleLeft: [],
    middleCenter: [],
    middleRight: [],
    bottomLeft: [],
    bottomCenter: [],
    bottomRight: [],
  };

  pieceX = { symbol: '❌' };
  pieceO = { symbol: '⭕' };

  @action beginDragging(piece, dragEvent) {
    let dragState;

    this.set('finishDrag', (dropEvent) => {
      if (this.activeCell) {
        let { x, y } = dropEvent;
        let { offsetX, offsetY } = dragEvent;
        set(piece, 'dropCoords', { x: x - offsetX, y: y - offsetY });
        this.set(`ticTacToeCells.${this.activeCell}`, [piece]);
        this.set('activeCell', null);
      }

      this.set('isDragging', false);
      set(piece, 'dragState', null);
    });

    dragState = {
      usingKeyboard: false,
      initialPointerX: dragEvent.x,
      initialPointerY: dragEvent.y,
      latestPointerX: dragEvent.x,
      latestPointerY: dragEvent.y
    };

    window.addEventListener('dragend', () => this.set('isDragging', false));
    this.set('isDragging', true)
    set(piece, 'dragState', dragState);
  }

  @action setActiveCell(cell) {
    this.set('activeCell', cell);
  }

  @action foo(event) {
    event.preventDefault();
  }

  @action dropPiece(event) {
    this.finishDrag(event);
  }

  * dragTransition ({ insertedSprites, keptSprites }) {
    keptSprites.forEach(sprite => {
      drag(sprite, { others: [] });
    });

    insertedSprites.forEach(sprite => {
      let dropCoords = sprite.owner.value.dropCoords;
      sprite.startAtPixel(dropCoords);
      move(sprite);
    })
  }
}
