import Route from '@ember/routing/route';
import '../css/card-pay.css';

export default class CardPayRoute extends Route {
  beforeModel(/* transition */) {
    this.transitionTo('card-pay.balances');
  }
}
