import { not } from '@ember/object/computed';
import Component from '@ember/component';
import layout from '../../templates/components/field-editors/image-editor';

export default Component.extend({
  layout,

  disabled: not('enabled'),

  actions: {
    updateImage(image) {
      this.set(`content.${this.get('field')}`, image);
      this.set('showUploader', false);
    }
  }
});
