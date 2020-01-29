import Component from '@glimmer/component';
import { action } from '@ember/object';
import { fieldTypeMappings, fieldComponents } from '@cardstack/core/utils/mappings';

export default class Catalog extends Component {
  fieldTypeMappings = fieldTypeMappings;
  fieldComponents = fieldComponents;

  @action
  initDrag() {
    this.isDragging = true;
  }

  @action startDragging(field, evt) {
    evt.dataTransfer.setData('text', evt.target.id);
    evt.dataTransfer.setData('text/type', field.type);
  }
}
