import Component from '@ember/component';
import layout from '../../templates/components/field-editors/image-upload-modal';

export default Component.extend({
  classNames: ['cardstack-image-upload-modal'],
  layout,

  actions: {
    uploadFile(event) {
      let file = event.target.files[0];
      let reader = new FileReader();
      reader.onload = (event) => {
        this.set('dataURL', event.target.result);
      };

      reader.readAsDataURL(file);
    },

    updateImage() {
      this.get('updateImage')(this.get('dataURL'));
    }
  }
});
