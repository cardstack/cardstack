import { action, set } from '@ember/object';
import CardManipulator from "./card-manipulator";
import drag from '../motions/drag';
import { printSprites } from 'ember-animated';
import { fadeOut } from 'ember-animated/motions/opacity';
import move from 'ember-animated/motions/move';

export default class CardCreator extends CardManipulator {
  fieldTypes = [
    {
      id: 'text-field',
      title: 'Text',
      description: 'All-purpose text field',
      type: 'string',
      icon: `/assets/images/field-types/text.png`
    },
    {
      id: 'text-area',
      title: 'Text Area',
      description: 'Multi-line text field',
      type: 'string',
      icon: `/assets/images/field-types/textarea.png`
    },
    {
      id: 'checkbox',
      title: 'Checkbox',
      description: 'Description',
      type: 'boolean',
      icon: `/assets/images/field-types/checkbox.png`
    },
    {
      id: 'phone-number-field',
      title: 'Phone Number',
      description: 'Description',
      type: 'string',
      icon: `/assets/images/field-types/phone-number.png`
    },
  ];

  @action
  updateCardId(id) {
    this.card = this.data.createCard(id, 'isolated');
  }

  @action
  beginDragging(field, mousedownEvent) {
    let dragState;

    set(this, 'finishDrag', (dropEvent) => {
      if (this.isOverDropZone) {
        let { x, y } = dropEvent;
        let { offsetX, offsetY } = mousedownEvent;
        set(field, 'dropCoords', { x: x - offsetX, y: y - offsetY });
        set(this, 'isOverDropZone', false);
      }

      set(this, 'isDragging', false);
      set(this, 'isEditingSchema', field);
      set(field, 'dragState', null);
    });

    dragState = {
      usingKeyboard: false,
      initialPointerX: mousedownEvent.x,
      initialPointerY: mousedownEvent.y,
      latestPointerX: mousedownEvent.x,
      latestPointerY: mousedownEvent.y
    };

    window.addEventListener('dragend', () => set(this, 'isDragging', false));
    set(this, 'isDragging', field);
    set(field, 'dragState', dragState);
  }

  @action toggleOverDropZone(value) {
    set(this, 'isOverDropZone', value);
  }

  @action dragOver(event) {
    event.preventDefault();
  }

  @action dropField(event) {
    this.finishDrag(event);
  }

  * dragTransition ({ insertedSprites, removedSprites, keptSprites }) {
    printSprites(arguments[0], 'transition');

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