import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

export default class DropZone extends Component {
  @tracked isOverDropZone = false;

  @action dragOver(event) {
    event.preventDefault();
  }
}