import { computed } from '@ember/object';
import Component from '@ember/component';
import layout from '../templates/components/cs-mobiledoc-editor';
import { task, timeout } from 'ember-concurrency';

export default Component.extend({
  layout,

  // We are deliberately only reading `mobiledoc` once and not
  // observing it for subsequent changes. We accept a separate docKey
  // property as a way to explicitly invalidate the document if
  // needed. This guards against data loops that would otherwise lose
  // cursor position.
  innerMobiledoc: computed('docKey', function() {
    return this.get('mobiledoc');
  }),

  onChange: task(function*(doc) {
    this.propertyDidChange('cursorState');
    this._nextDoc = doc;
    yield timeout(500); // this debounces changes so that we're not
    // propagating things up to the model on every
    // keystroke, which can cause laggy typing.
    let handler = this.get('on-change');
    if (handler) {
      handler(doc);
    }
    this._nextDoc = null;
  }).restartable(),

  willDestroyElement() {
    if (this.get('onChange.isRunning')) {
      // If there were changes pending in the debouncer, hurry them
      // out before we're destroyed.
      this.get('onChange').cancelAll();
      let handler = this.get('on-change');
      if (handler) {
        handler(this._nextDoc);
      }
    }
    this._super();
  },

  actions: {
    cursorChanged(cursorUpdate) {
      this.set('cursorState', cursorUpdate);
    },
  },
});
