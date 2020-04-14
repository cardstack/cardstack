import Controller from '@ember/controller';
import { action, set } from '@ember/object';
import move from 'ember-animated/motions/move';
import drag from '../../motions/drag';
import { fadeOut } from 'ember-animated/motions/opacity';
import opacity from 'ember-animated/motions/opacity';

export default class DemoTicTacToeEnhancedController extends Controller {
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

  pieceX = { symbol: '❌', name: 'piece-x' };
  pieceO = { symbol: '⭕', name: 'piece-o' };

  @action beginDragging(piece, mousedownEvent) {
    let dragState;

    this.set('finishDrag', (dropEvent) => {
      if (this.activeCell) {
        let { x, y } = dropEvent;
        let { offsetX, offsetY } = mousedownEvent;
        set(piece, 'dropCoords', { x: x - offsetX, y: y - offsetY });
        this.set(`ticTacToeCells.${this.activeCell}`, [piece]);
        this.set('activeCell', null);
      }

      this.set('isDragging', false);
      set(piece, 'dragState', null);
    });

    dragState = {
      usingKeyboard: false,
      initialPointerX: mousedownEvent.x,
      initialPointerY: mousedownEvent.y,
      latestPointerX: mousedownEvent.x,
      latestPointerY: mousedownEvent.y
    };

    window.addEventListener('dragend', () => this.set('isDragging', false));
    this.set('isDragging', piece);
    set(piece, 'dragState', dragState);
  }

  @action setActiveCell(cellName, cellValue) {
    if (!cellValue.length || !cellName) {
      this.set('activeCell', cellName);
    }
  }

  @action dragOver(event) {
    event.preventDefault();
  }

  @action dropPiece(event) {
    this.finishDrag(event);
  }

  * previewTransition ({ insertedSprites, removedSprites }) {
    insertedSprites.forEach(opacity);
    removedSprites.forEach(fadeOut);
  }

  * dragTransition ({ insertedSprites, removedSprites, keptSprites }) {
    keptSprites.forEach(sprite => {
      drag(sprite, { others: [] });
    });

    insertedSprites.forEach(sprite => {
      if (sprite.owner.value.dropCoords) {
        let dropCoords = sprite.owner.value.dropCoords;
        sprite.startAtPixel(dropCoords);
        move(sprite);
      } else {
        sprite.moveToFinalPosition();
      }
    });

    removedSprites.forEach(fadeOut);
  }
}
