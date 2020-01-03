import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { fadeIn, fadeOut } from 'ember-animated/motions/opacity';

const duration = 250;

export default class DropZone extends Component {
  @tracked dropZoneStatus = 'outside';

  get stubField() {
    return {
      name: 'new field',
      label: 'New Field',
      type: '@cardstack/core-types::string',
    };
  }

  get isOverDropZone() {
    return this.dropZoneStatus === 'dragging';
  }

  @action dragOver(event) {
    event.preventDefault();
  }

  *expandPreview({ insertedSprites, removedSprites }) {
    insertedSprites.forEach(sprite => {
      fadeIn(sprite, { duration });
    });
    removedSprites.forEach(sprite => {
      fadeOut(sprite, { duration });
    });
  }
}
