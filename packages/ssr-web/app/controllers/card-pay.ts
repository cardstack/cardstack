import Controller from '@ember/controller';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import Layer1Network from '@cardstack/ssr-web/services/layer1-network';
import Layer2Network from '@cardstack/ssr-web/services/layer2-network';
import { tracked } from '@glimmer/tracking';
import { currentNetworkDisplayInfo as c } from '../utils/web3-strategies/network-display-info';

interface NetworkProblemModalOptions {
  title: string;
  body: string;
  actionText: string;
  action: Function;
  onClose: Function;
  dismissable: boolean;
}

export default class CardPayController extends Controller {
  cardPayLogo = '/images/icons/card-pay-logo.svg';
  @service declare layer1Network: Layer1Network;
  @service declare layer2Network: Layer2Network;
  @tracked isShowingLayer1ConnectModal = false;
  @tracked isShowingLayer2ConnectModal = false;
  @tracked needsReload = false;
  @tracked networkProblemModalOptions: NetworkProblemModalOptions | null = null;

  constructor() {
    super(...arguments);

    this.layer1Network.on('correct-chain', this.maybeReload);
    this.layer1Network.on('disconnect', this.maybeReload);
    this.layer1Network.on('incorrect-chain', this.onLayer1Incorrect);
    this.layer1Network.on('websocket-disconnected', () =>
      this.showWebsocketDisconnectedModal('layer1')
    );

    this.layer2Network.on('incorrect-chain', this.onLayer2Incorrect);
    this.layer2Network.on('websocket-disconnected', () =>
      this.showWebsocketDisconnectedModal('layer2')
    );
  }

  @action disconnectLayer1() {
    this.layer1Network.disconnect();
  }

  @action showWebsocketDisconnectedModal(network: keyof typeof c) {
    if (this.networkProblemModalOptions) return;
    this.showNetworkProblemModal({
      title: `Disconnected from ${c[network].fullName}`,
      body: `An unexpected error happened and the connection with ${c[network].fullName} was lost. To restore the connection and resume your work, please refresh the page.`,
      onClose: this.hideNetworkProblemModal,
      action: () => window.location.reload(),
      actionText: 'Refresh Page',
      dismissable: true,
    });
  }

  @action
  onLayer1Incorrect() {
    this.needsReload = true;
    this.showNetworkProblemModal({
      title: `Please connect to ${c.layer1.fullName}`,
      body: `Card Pay uses ${c.layer1.fullName} as its Layer 1 network. To ensure the safety of your assets and transactions, this page will reload as soon as you change your wallet’s network to ${c.layer1.fullName} or disconnect your wallet.`,
      onClose: () => {},
      action: this.disconnectLayer1,
      actionText: 'Disconnect and Reload',
      dismissable: false,
    });
  }

  @action
  onLayer2Incorrect() {
    // don't allow layer 2 modal options to override layer 1
    if (this.networkProblemModalOptions) return;
    this.showNetworkProblemModal({
      title: `Please connect to ${c.layer2.fullName}`,
      body: `Card Pay uses ${c.layer2.fullName} as its Layer 2 network. To ensure the safety of your assets and transactions, we’ve disconnected your wallet. You can restart any incomplete workflows after reconnecting with ${c.layer2.fullName}.`,
      onClose: this.hideNetworkProblemModal,
      action: this.hideNetworkProblemModal,
      actionText: 'Dismiss',
      dismissable: true,
    });
  }

  @action
  maybeReload() {
    if (!this.needsReload) {
      return;
    }

    window.location.reload();
  }

  @action
  showNetworkProblemModal(options: NetworkProblemModalOptions) {
    this.networkProblemModalOptions = options;
  }

  @action
  hideNetworkProblemModal() {
    this.networkProblemModalOptions = null;
  }

  @action transitionTo(routeName: string) {
    this.transitionToRoute(routeName);
  }
}
