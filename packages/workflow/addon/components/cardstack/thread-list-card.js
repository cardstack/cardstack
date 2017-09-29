import Component from "@ember/component";

export default Component.extend({
  thread: null,

  actions: {
    select() {
      this.get('onSelect')();
    }
  }
});
