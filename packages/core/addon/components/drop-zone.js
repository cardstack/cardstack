import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import fade from 'ember-animated/transitions/fade';
import { fadeIn, fadeOut } from 'ember-animated/motions/opacity';
import { printSprites } from 'ember-animated';

const duration = 250;

export default class DropZone extends Component {
  @tracked dropZoneStatus = 'outside';
  fade = fade;

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
    printSprites(arguments[0], 'outerTransition');
    insertedSprites.forEach(sprite => {
      fadeIn(sprite, { duration });
    });
    removedSprites.forEach(sprite => {
      fadeOut(sprite, { duration });
    });
    // keptSprites.forEach(sprite => {
    //   resize(sprite, { easing: easeInAndOut });
    // });
  }
}
