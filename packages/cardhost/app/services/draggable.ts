import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { Card } from '@cardstack/core/card';

export default class DraggableService extends Service {
  @tracked field: Card | undefined;
  @tracked startingPosition: number | undefined;
  @tracked dropzone: HTMLElement | undefined;
  @tracked dragging = false;

  /**
   * Sets the currently dragged field
   */
  setField(field: Card, startingPosition: number) {
    this.field = field;
    this.startingPosition = startingPosition;
  }

  /**
   * Gets the currently dragged field
   */
  getField() {
    return this.field;
  }

  /**
   * Gets the starting position of the dragged field
   */
  getStartingPosition() {
    return this.startingPosition;
  }

  /**
   * Clears the dragged field
   */
  clearField() {
    this.field = undefined;
    this.startingPosition = undefined;
  }

  /**
   * Set the hovered drop zone
   */
  setDropzone(element: HTMLElement) {
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
      this.triggerEvent(this.dropzone, 'mouseleave');
      this.dropzone = undefined;
    }
  }

  /**
   * Set the dragging flag
   */
  setDragging(isDragging: boolean) {
    this.dragging = isDragging;
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

  triggerEvent(el: HTMLElement, type: string) {
    var e = document.createEvent('HTMLEvents');
    e.initEvent(type, false, true);
    el.dispatchEvent(e);
  }
}
