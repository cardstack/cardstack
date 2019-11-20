import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default class CardsRoute extends Route {
  @service css
  queryParams = { editingCss: {} }

  model({ editingCss }) {
    this.css.setEditingCss(editingCss);
  }
}
