import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default class CardsRoute extends Route {
  @service cssModeToggle
  queryParams = { editingCss: {} }

  model({ editingCss }) {
    let editingBool = editingCss === "true" ? true : false;
    this.cssModeToggle.setEditingCss(editingBool);
  }
}