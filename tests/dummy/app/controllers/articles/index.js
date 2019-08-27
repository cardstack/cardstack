import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class ArticlesController extends Controller {
  @tracked model;

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
