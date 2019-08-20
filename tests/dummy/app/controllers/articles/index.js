import Controller from '@ember/controller';
import { action, computed } from '@ember/object';

export default class ArticlesController extends Controller {
  @computed('model', 'modelName')
  get modelName() {
    return this.model.constructor.modelName;
  }

  @action
  edit() {
    this.transitionToRoute('tools.edit', this.modelName, this.model.id);
  }

  @action
  preview() {
    this.transitionToRoute('tools.preview', this.modelName, this.model.id);
  }
}
