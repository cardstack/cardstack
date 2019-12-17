import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import fade from 'ember-animated/transitions/fade';
import resize from 'ember-animated/motions/resize';
import { easeInAndOut } from 'ember-animated/easings/cosine';
import { printSprites } from 'ember-animated';

export default class DropZone extends Component {
  @tracked isOverDropZone = false;

  fade = fade;

  get stubField() {
    return {
      name: 'new field',
      label: 'New Field',
      type: '@cardstack/core-types::string'
    };
  }

  @action dragOver(event) {
    event.preventDefault();
  }

  *expandPreview({ keptSprites }) {
    printSprites(arguments[0], 'outerTransition');
    keptSprites.forEach(sprite => {
      resize(sprite, { easing: easeInAndOut });
    });
  }
}
