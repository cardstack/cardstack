import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';

export default class DropZone extends Component {
  @tracked dropZoneStatus = 'outside';

  @service draggedField;

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
    let draggedField = this.draggedField.getField();

    console.log('draggedField', draggedField);

    if (!draggedField) {
      return;
    }

    this.dropZoneStatus = status;

    if (this.args.toggleStubField) {
      this.args.toggleStubField(this.stubField, this.args.position, this.isOverDropZone);
    }
  }

  @action dragOver(event) {
    event.preventDefault();
  }
}
