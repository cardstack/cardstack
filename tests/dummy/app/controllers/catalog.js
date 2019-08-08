import Controller from '@ember/controller';

export default Controller.extend({
  actions: {
    preview(modelName) {
      this.transitionToRoute('catalog.preview', modelName);
    }
  }
})
