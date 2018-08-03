import Service from "@ember/service";
import { A } from "@ember/array"

export default Service.extend({
  init() {
    this._super(...arguments);

    this.topLevelComponents = A();
  },

  registerTopLevelComponent(componentName) {
    this.topLevelComponents.pushObject(componentName);
  }
});