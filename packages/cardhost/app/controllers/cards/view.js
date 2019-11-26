import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';

export default class ViewCardController extends Controller {
  @service cssModeToggle

  get cardJson() {
    if (!this.model) { return null; }
    return JSON.stringify(this.model.json, null, 2);
  }

  saveCss(css) {
    this.model.isolatedCss = css;
    console.log(this.model)
    // this.model.save()
  }
}