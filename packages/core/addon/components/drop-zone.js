import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

export default class DropZone extends Component {
  @tracked dropZoneStatus = 'outside';

  get stubField() {
    return {
      name: 'new field',
      label: 'New Field',
      type: 'new-field',
      preview: true,
    };
  }

  get isOverDropZone() {
    return this.dropZoneStatus === 'dragging';
  }

  @action
  updateStatus(status) {
    this.dropZoneStatus = status;

    if (this.args.toggleStubField) {
      this.args.toggleStubField(this.stubField, this.args.position, this.isOverDropZone);
    }
  }

  @action dragOver(event) {
    event.preventDefault();
  }
}
