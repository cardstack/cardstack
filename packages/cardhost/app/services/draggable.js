import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';

export default class DraggableService extends Service {
  @tracked field;
  @tracked dropzone;
  @tracked dragging;

  /**
   * Sets the currently dragged field
   */
  setField(field) {
    console.log('setting field to ', field.id);
    this.field = field;
  }

  /**
   * Gets the currently dragged field
   */
  getField() {
    return this.field;
  }

  /**
   * Clears the dragged field
   */
  clearField() {
    console.log('clearing field');
    this.field = null;
  }

  /**
   * Set the hovered drop zone
   */
  setDropzone(element) {
    this.dropzone = element;
    this.triggerEvent(element, 'mouseenter');
  }

  /**
   * Get the hovered drop zone
   */
  getDropzone() {
    return this.dropzone;
  }

  /**
   * Clear the dropzone
   */
  clearDropzone() {
    if (this.dropzone) {
      console.log('clearing dropzone');
      this.triggerEvent(this.dropzone, 'mouseleave');
      this.dropzone = null;
    }
  }

  /**
   * Set the dragging flag
   */
  setDragging(val) {
    console.log('set dragging to', val);
    this.dragging = val;
  }

  /**
   * Check if dragging
   */
  get isDragging() {
    return this.dragging;
  }

  /**
   * Drop
   */
  drop() {
    if (this.dropzone && this.field) {
      this.triggerEvent(this.dropzone, 'mouseup');
    }
  }

  triggerEvent(el, type) {
    var e = document.createEvent('HTMLEvents');
    e.initEvent(type, false, true);
    el.dispatchEvent(e);
  }
}
