import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class UIComponentsController extends Controller {
  cardstackSession = { isAuthenticated: true };

  @tracked isChecked;

  @action
  noop() {}

  @action
  setChecked(field, val) {
    this[field] = val;
  }
}
