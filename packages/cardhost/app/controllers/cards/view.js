import Controller from '@ember/controller';
export default class ViewCardController extends Controller {
  get cardJson() {
    if (!this.model) { return null; }
    return JSON.stringify(this.model.json, null, 2);
  }
}