import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { htmlSafe } from '@ember/template';

export default class ToolsEditController extends Controller {
  @tracked model;

  get backgroundImageUrl() {
    return htmlSafe(`background-image: url(${this.model.imageUrl})`);
  }

  @action
  async preview() {
    await this.model.save();

    return await this.transitionToRoute('tools.preview', this.model.constructor.modelName, this.model.id);
  }

  @action
  async save() {
    await this.model.save();
    if (this.model.constructor.modelName === 'event') {
      this.transitionToRoute('events.view', this.model);
    } else {
      this.transitionToRoute('articles', this.model);
    }
  }
}
