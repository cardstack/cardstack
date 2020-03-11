import Controller from '@ember/controller';
import { inject as service } from '@ember/service';

export default class ApplicationController extends Controller {
  @service overlays;

  get showLoading() {
    return this.overlays.showLoading;
  }
}
