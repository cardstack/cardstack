import Controller from '@ember/controller';
import { action } from '@ember/object';

export default class UIComponentsController extends Controller {
  cardstackSession = { isAuthenticated: true };

  @action
  noop() {}
}
