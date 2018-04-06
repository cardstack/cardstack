import { not } from '@ember/object/computed';
import Component from '@ember/component';
import layout from '../../templates/components/field-editors/image-editor';

export default Component.extend({
  layout,

  disabled: not('enabled'),

  actions: {
    updateImage(dataURL) {
      let imageData = {
        base64: dataURL
      }
      this.set(`content.${this.get('field')}`, imageData);
      this.set('showUploader', false);
    }
  }
});
