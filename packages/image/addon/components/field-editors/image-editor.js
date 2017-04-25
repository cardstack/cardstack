import Ember from 'ember';
import layout from '../../templates/components/field-editors/image-editor';

export default Ember.Component.extend({
  layout,

  disabled: Ember.computed.not('enabled'),

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
