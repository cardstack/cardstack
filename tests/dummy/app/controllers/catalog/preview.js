import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';

export default class CatalogPreviewController extends Controller {
  @service boxel;

  @action
  editModel() {
    this.boxel.set('currentPlane', 'tools');

    this.transitionToRoute('tools.edit', this.model.constructor.modelName, this.model.id);
  }
}
