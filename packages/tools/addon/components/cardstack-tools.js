import EdgesComponent from '@cardstack/edges/components/cardstack-edges';
import { deprecate } from "@ember/application/deprecations";

export default EdgesComponent.extend({
  init() {
    this._super(...arguments);
    deprecate("The cardstack-tools component is deprecated. Please use the cardstack-edges component instead", false, {
      id: 'cardstack-tools-to-edges-deprecation',
      until: "0.9"
    });
  }
});
