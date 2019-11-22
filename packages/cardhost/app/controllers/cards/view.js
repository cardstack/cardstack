import Controller from '@ember/controller';
import { inject as service } from '@ember/service';

export default class ViewCardController extends Controller {
  @service cssModeToggle

  get cardJson() {
    if (!this.model) { return null; }
    return JSON.stringify(this.model.json, null, 2);
  }
}