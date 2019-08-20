import Controller from '@ember/controller';
import { action } from '@ember/object';

export default class ToolsPreviewController extends Controller {
  @action
  edit() {
    return this.transitionToRoute('tools.edit', this.model.constructor.modelName, this.model.id);
  }
}
