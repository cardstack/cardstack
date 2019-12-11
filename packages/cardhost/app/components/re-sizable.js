import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { dasherize, capitalize, htmlSafe } from '@ember/string';
import { isNone } from '@ember/utils';
import { action } from '@ember/object';
import { guidFor } from '@ember/object/internals';

/*global window, document*/

const getSize = n => (!isNaN(parseFloat(n)) && isFinite(n) ? `${n}px` : n);

/**
 * Actions accepted: onResizeStart, onResizeStop, onResize
 * Arguments accepted: directions array (i.e. ['left'], classNames string (i.e. "my-class another-class")
 */

export default class ReSizable extends Component {
  @tracked elementId = guidFor(this);
  minWidth = 10;
  minHeight = 10;
  maxWidth = null;
  maxHeight = null;
  grid = [1, 1];
  get directions() {
    return (
      this.args.directions || ['top', 'right', 'bottom', 'left', 'topRight', 'bottomRight', 'bottomLeft', 'topLeft']
    );
  }

  @action
  setElement() {
    // done this way so that we only query once. If this was a getter instead,
    //it would be called 100s of times a second, because it us used by the mousemove event.
    this.el = document.querySelector(`#${this.elementId}`);
  }

  @tracked isActive = false;
  @tracked width;
  @tracked height;

  @tracked elementWidth = this.args.width;
  @tracked elementHeight = this.args.height;
  @tracked _original;

  get lockAspectRatio() {
    if (typeof this.args.lockAspectRatio === 'boolean') {
      return this.args.lockAspectRatio;
    } else {
      return false;
    }
  }

  get style() {
    let s = '';
    if (!isNone(this.args.width)) {
      s = `width: ${getSize(this.elementWidth || this.args.width)};`;
    }
    if (!isNone(this.args.height)) {
      s = `${s}height: ${getSize(this.elementHeight || this.args.height)};`;
    }

    return s.length ? htmlSafe(s) : null;
  }

  getBoxSize() {
    let el = this.el;
    if (!el) {
      return;
    }
    const style = window.getComputedStyle(el);
    if (!style) {
      return;
    }
    const width = ~~style.getPropertyValue('width').replace('px', '');
    const height = ~~style.getPropertyValue('height').replace('px', '');
    return { width, height };
  }

  @action
  _onResizeStart(direction, event) {
    if (event.touches) {
      event = event.touches[0];
    } else {
      if (event.button === 2) {
        // Upon click with right mouse button we can become stuck in resizing mode
        return;
      }
    }

    if (this.args.onResizeStart) {
      let el = this.el;
      this.args.onResizeStart(direction, event, el);
    }

    const size = this.getBoxSize();
    this.isActive = true;
    this._original = {
      x: event.clientX,
      y: event.clientY,
      width: size.width,
      height: size.height,
    };
    this._direction = direction;
    let el = this.el;
    if (!el) {
      return;
    }

    el.addEventListener('mouseup', this._onMouseUp);
    // have to use the document, otherwise you can move the mouse too fast and lose tracking
    document.addEventListener('mousemove', this._onMouseMove);
    el.addEventListener('touchmove', this._onTouchMove);
    el.addEventListener('touchend', this._onMouseUp);
  }

  @action
  _onTouchMove(event) {
    this._onMouseMove(event.touches[0]);
  }

  _calculateResized(originalPos, currentPos, dimension, snapSize) {
    let newSize = this._original[dimension] + currentPos - originalPos;
    newSize = Math.max(
      Math.min(newSize, this[`max${capitalize(dimension)}`] || newSize),
      this[`min${capitalize(dimension)}`] || 0
    );
    newSize = Math.round(newSize / snapSize) * snapSize;
    return newSize;
  }

  @action
  _onMouseMove({ clientX, clientY }) {
    if (!this.isActive) {
      return;
    }
    const direction = dasherize(this._direction);
    const original = this._original;
    const ratio = original.height / original.width;
    let newWidth = original.width;
    let newHeight = original.height;

    if (direction.includes('right') || direction.includes('left')) {
      let factor = direction.includes('left') ? -1 : 1;
      newWidth = this._calculateResized(original.x * factor, clientX * factor, 'width', this.grid[0]);
    }

    if (direction.includes('bottom') || direction.includes('top')) {
      let factor = direction.includes('top') ? -1 : 1;
      newHeight = this._calculateResized(original.y * factor, clientY * factor, 'height', this.grid[1]);
    }

    if (this.lockAspectRatio) {
      const deltaWidth = Math.abs(newWidth - original.width);
      const deltaHeight = Math.abs(newHeight - original.height);
      if (deltaWidth < deltaHeight) {
        newWidth = newHeight / ratio;
      } else {
        newHeight = newWidth * ratio;
      }
    }

    this.elementWidth = newWidth;
    this.elementHeight = newHeight;
    let el = this.el;

    if (this.args.onResize) {
      this.args.onResize(
        this._direction,
        { width: newWidth, height: newHeight },
        { width: newWidth - original.width, height: newHeight - original.height },
        el
      );
    }
  }

  @action
  _onMouseUp() {
    if (!this.isActive) {
      return;
    }

    if (this.args.onResizeStop) {
      const styleSize = this.getBoxSize();
      this.args.onResizeStop(
        this._direction,
        { width: styleSize.width - this._original.width, height: styleSize.height - this._original.height },
        this.el
      );
    }

    this.isActive = false;

    this.el.removeEventListener('mouseup', this._onMouseUp);
    document.removeEventListener('mousemove', this._onMouseMove);
    this.el.removeEventListener('touchmove', this._onTouchMove);
    this.el.removeEventListener('touchend', this._onMouseUp);
  }

  willDestroy() {
    // ensure teardown in case of hiccups with onMouseUp state
    this.el.removeEventListener('mouseup', this._onMouseUp);
    document.removeEventListener('mousemove', this._onMouseMove);
    this.el.removeEventListener('touchmove', this._onTouchMove);
    this.el.removeEventListener('touchend', this._onMouseUp);
  }
}
