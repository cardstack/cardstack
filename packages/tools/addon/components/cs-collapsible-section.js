import Component from '@ember/component';
import { computed } from '@ember/object';
import layout from '../templates/components/cs-collapsible-section';

export default Component.extend({
  layout,
  tagName: 'section',
  classNameBindings: ['opened:opened:closed', 'hasInvalidFields:invalid'],
  animationRules,

  init() {
    this._super();
    this.set('fieldEditors', []);
  },

  mouseEnter(event) {
    let hovered = this.get('hovered');
    if (hovered) {
      hovered(event);
    }
  },
  mouseLeave(event) {
    let unhovered = this.get('unhovered');
    if (unhovered) {
      unhovered(event);
    }
  },

  hasInvalidFields: computed('fieldEditors.@each.hasValidationError', function() {
    return this.fieldEditors.isAny('hasValidationError');
  }),

  actions: {
    registerFieldEditor(fieldEditor) {
      this.fieldEditors.addObject(fieldEditor);
    },

    unregisterFieldEditor(fieldEditor) {
      this.fieldEditors.removeObject(fieldEditor);
    },

    toggle() {
      if (this.get('opened')) {
        this.get('close')();
      } else {
        this.get('open')();
      }
    }
  }
});

function animationRules() {
  this.transition(
    this.fromValue(false),
    this.toValue(true),
    this.use('to-down', { duration: 250 }),
    this.reverse('to-up', { duration: 250 })
  );
}
