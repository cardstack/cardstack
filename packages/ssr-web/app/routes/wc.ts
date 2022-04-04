import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import Fastboot from 'ember-cli-fastboot/services/fastboot';
import '../css/wc.css';
import AppContext from '../services/app-context';
export default class WcRoute extends Route {
  @service declare appContext: AppContext;
  @service declare fastboot: Fastboot;

  beforeModel() {
    if (this.appContext.isCardSpace) {
      this.transitionTo('index');
    }
  }
}
