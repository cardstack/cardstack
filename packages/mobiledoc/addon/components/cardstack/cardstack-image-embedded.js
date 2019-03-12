import { computed } from '@ember/object';
import Component from '@ember/component';
import { hubURL } from "@cardstack/plugin-utils/environment";
import layout from '../../templates/components/cardstack/cardstack-image-embedded';

export default Component.extend({
  layout,
  tagName: '',
  imageSrc: computed(function() {
    return `${hubURL}/api/cardstack-files/${this.get('content.file.id')}`;
  }),
});