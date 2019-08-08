import Controller from '@ember/controller';

export default Controller.extend({
  actions: {
    createNew(model) {
      let modelName = model.constructor.modelName;

      this.transitionToRoute('catalog.create', modelName);
    }
  }
})
