import Controller from '@ember/controller';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import Layer1Network from '@cardstack/web-client/services/layer1-network';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import { tracked } from '@glimmer/tracking';
import '../css/card-pay.css';

const TABLIST = [
  {
    id: 'about',
    title: 'About Card Pay',
    route: 'card-pay.index',
    icon: 'home',
  },
  {
    id: 'balances',
    title: 'Card Balances',
    route: 'card-pay.balances',
    icon: 'wallet',
  },
  {
    id: 'merchant-services',
    title: 'Merchant Services',
    route: 'card-pay.merchant-services',
    icon: 'merchant',
  },
  {
    id: 'reward-programs',
    title: 'Reward Programs',
    route: 'card-pay.reward-programs',
    icon: 'reward',
  },
  {
    id: 'token-suppliers',
    title: 'Token Suppliers',
    route: 'card-pay.token-suppliers',
    icon: 'token',
  },
];

export default class CardPayController extends Controller {
  cardPayLogo = '/images/icons/card-pay-logo.svg';
  tabList = TABLIST;
  @service declare layer1Network: Layer1Network;
  @service declare layer2Network: Layer2Network;
  @tracked isShowingLayer1ConnectModal = false;
  @tracked isShowingLayer2ConnectModal = false;
  @tracked displayMenu = false;

  @action transitionTo(routeName: string) {
    this.transitionToRoute(routeName);
  }

  @action toggleMenu() {
    this.displayMenu = !this.displayMenu;
  }
}
