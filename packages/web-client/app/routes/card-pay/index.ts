import Route from '@ember/routing/route';

export default class CardPayIndexRoute extends Route {
  beforeModel(/* transition */) {
    this.transitionTo('card-pay.balances');
  }
}
