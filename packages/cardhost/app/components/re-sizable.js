import Component from '@glimmer/component';
import { dasherize, capitalize, htmlSafe } from '@ember/string';
import { isNone } from '@ember/utils';
import { action, computed } from '@ember/object';
// import { addEventListener, removeEventListener, runDisposables } from 'ember-lifeline';

/*global window*/

const getSize = n => (!isNaN(parseFloat(n)) && isFinite(n) ? `${n}px` : n);

export default class ReSizable extends Component {
  // minWidth = 10;
  // minHeight = 10;
  // maxWidth = null;
  // maxHeight = null;
  // grid = [1, 1];
  // lockAspectRatio = false;
  // directions = ['top', 'right', 'bottom', 'left', 'topRight', 'bottomRight', 'bottomLeft', 'topLeft'];

  // onResizeStart = null;
  // onResizeStop = null;
  // onResize = null;

  // isActive = false;

  // @computed('width', 'height', 'elementWidth', 'elementHeight')
  // get style() {
  //   let s = '';
  //   if (!isNone(this.width)) {
  //     s = `width: ${getSize(this.elementWidth || this.width)};`;
  //   }
  //   if (!isNone(this.height)) {
  //     s = `${s}height: ${getSize(this.elementHeight || this.height)};`;
  //   }

  //   // can we be sure this actually is safe?
  //   return s.length ? htmlSafe(s) : null;
  // }

  // @computed('_width')
  // get width() {
  //   return this._width;
  // }

  // set width(value) {
  //   this._width = value;
  //   this.elementWidth = value;
  // }

  // @computed('_height')
  // get height() {
  //   return this._height;
  // }

  // set height(value) {
  //   this._height = value;
  //   this.elementHeight = value;
  // }

  // willDestroy() {
  //   runDisposables(this);
  // }

  // getBoxSize() {
  //   const style = window.getComputedStyle(this.element);
  //   const width = ~~style.getPropertyValue('width').replace('px', '');
  //   const height = ~~style.getPropertyValue('height').replace('px', '');
  //   return { width, height };
  // }

  // @action
  // _onResizeStart(direction, event) {
  //   if (event.touches) {
  //     event = event.touches[0];
  //   } else {
  //     if (event.button === 2) {
  //       // Upon click with right mouse button we can become stuck in resizing mode
  //       return;
  //     }
  //   }

  //   if (this.onResizeStart) {
  //     this.onResizeStart(direction, event, this.element);
  //   }

  //   const size = this.getBoxSize();
  //   this.set('isActive', true);
  //   this.set('_original', {
  //     x: event.clientX,
  //     y: event.clientY,
  //     width: size.width,
  //     height: size.height,
  //   });
  //   this.set('_direction', direction);

  //   addEventListener(this, window, 'mouseup', this._onMouseUp);
  //   addEventListener(this, window, 'mousemove', this._onMouseMove);
  //   addEventListener(this, window, 'touchmove', this._onTouchMove);
  //   addEventListener(this, window, 'touchend', this._onMouseUp);
  // }

  // _onTouchMove(event) {
  //   this._onMouseMove(event.touches[0]);
  // }

  // _calculateResized(originalPos, currentPos, dimension, snapSize) {
  //   let newSize = this._original[dimension] + currentPos - originalPos;
  //   newSize = Math.max(
  //     Math.min(newSize, this.max[capitalize(dimension)] || newSize),
  //     this.min[capitalize(dimension)] || 0
  //   );
  //   newSize = Math.round(newSize / snapSize) * snapSize;
  //   return newSize;
  // }

  // _onMouseMove({ clientX, clientY }) {
  //   const direction = dasherize(this._direction);
  //   const original = this._original;
  //   const ratio = original.height / original.width;
  //   let newWidth = original.width;
  //   let newHeight = original.height;

  //   if (direction.includes('right') || direction.includes('left')) {
  //     let factor = direction.includes('left') ? -1 : 1;
  //     newWidth = this._calculateResized(original.x * factor, clientX * factor, 'width', this.grid[0]);
  //   }

  //   if (direction.includes('bottom') || direction.includes('top')) {
  //     let factor = direction.includes('top') ? -1 : 1;
  //     newHeight = this._calculateResized(original.y * factor, clientY * factor, 'height', this.grid[1]);
  //   }

  //   if (this.lockAspectRatio) {
  //     const deltaWidth = Math.abs(newWidth - original.width);
  //     const deltaHeight = Math.abs(newHeight - original.height);
  //     if (deltaWidth < deltaHeight) {
  //       newWidth = newHeight / ratio;
  //     } else {
  //       newHeight = newWidth * ratio;
  //     }
  //   }

  //   this.elementWidth = newWidth;
  //   this.elementHeight = newHeight;

  //   if (this.onResize) {
  //     this.onResize(
  //       this._direction,
  //       { width: newWidth, height: newHeight },
  //       { width: newWidth - original.width, height: newHeight - original.height },
  //       this.element
  //     );
  //   }
  // }

  // _onMouseUp() {
  //   if (!this.isActive) {
  //     return;
  //   }

  //   if (this.onResizeStop) {
  //     const styleSize = this.getBoxSize();
  //     this.onResizeStop(
  //       this._direction,
  //       { width: styleSize.width - this._original.width, height: styleSize.height - this._original.height },
  //       this.element
  //     );
  //   }

  //   this.isActive = false;

  //   removeEventListener(this, window, 'mouseup', this._onMouseUp);
  //   removeEventListener(this, window, 'mousemove', this._onMouseMove);
  //   removeEventListener(this, window, 'touchmove', this._onTouchMove);
  //   removeEventListener(this, window, 'touchend', this._onMouseUp);
  // }
}
