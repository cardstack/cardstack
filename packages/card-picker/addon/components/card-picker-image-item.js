import Component from '@ember/component';
import { computed } from '@ember/object';
import { hubURL } from "@cardstack/plugin-utils/environment";
import layout from '../templates/components/card-picker-image-item';

export default Component.extend({
  layout,
  tagName: '',
  imageSrc: computed('content.file.id', function() {
    return `${hubURL}/api/cardstack-files/${this.get('content.file.id')}`;
  }),
});