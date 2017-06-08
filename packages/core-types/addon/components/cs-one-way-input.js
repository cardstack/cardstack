import Ember from 'ember';
import layout from '../templates/components/cs-one-way-input';

export default Ember.Component.extend({
  layout,
  tagName: '',
  type: 'text',
  actions: {
    maybeEnter(event) {
      if (event.keyCode === 13) {
        let onEnter = this.get('onenter');
        if (onEnter) {
          onEnter();
        }
      }
    },
    onChange(value) {
      let onchange = this.get("onchange");
      if (onchange) {
        onchange(value);
      }
    },
    onFocus(event) {
      let onfocus = this.get("onfocus");
      if (onfocus) {
        onfocus(event);
      }
    },
    onBlur(event) {
      let onblur = this.get("onblur");
      if (onblur) {
        onblur(event);
      }
    }
  }
});
