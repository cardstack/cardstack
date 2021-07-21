import Controller from '@ember/controller';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import Layer1Network from '@cardstack/web-client/services/layer1-network';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import { tracked } from '@glimmer/tracking';
import { currentNetworkDisplayInfo as c } from '../utils/web3-strategies/network-display-info';

interface ChainChangeModalOptions {
  title: string;
  body: string;
  actionText: string;
  action: Function;
  onClose: Function;
  dismissable: boolean;
}

const networkCorrectionMessages = {
  layer1: {
    title: `Please connect to ${c.layer1.fullName}`,
    body: `You need to be connected to ${c.layer1.fullName} on Layer 1 in order to use Card Pay. To ensure the safety of your mainnet assets and transactions, this page will reload as soon as you connect to the correct network, or disconnect from the layer 1 network.`,
  },
  layer2: {
    title: `Please connect to ${c.layer2.fullName}`,
    body: `You need to be connected to ${c.layer2.fullName} on Layer 2 in order to use Card Pay. We've disconnected you from the current network, and canceled your workflows.`,
  },
};

export default class CardPayController extends Controller {
  cardPayLogo = '/images/icons/card-pay-logo.svg';
  @service declare layer1Network: Layer1Network;
  @service declare layer2Network: Layer2Network;
  @tracked isShowingLayer1ConnectModal = false;
  @tracked isShowingLayer2ConnectModal = false;
  @tracked needsReload = false;
  @tracked chainChangeModalOptions: ChainChangeModalOptions | null = null;

  constructor() {
    super(...arguments);

    this.layer1Network.on('correct-chain', this.maybeReload);
    this.layer1Network.on('disconnect', this.maybeReload);
    this.layer1Network.on('incorrect-chain', this.onLayer1Incorrect);

    this.layer2Network.on('incorrect-chain', this.onLayer2Incorrect);
  }

  @action disconnectLayer1() {
    this.layer1Network.disconnect();
  }

  @action
  onLayer1Incorrect() {
    this.needsReload = true;
    this.showChainChangeModal({
      ...networkCorrectionMessages.layer1,
      onClose: () => {},
      action: this.disconnectLayer1,
      actionText: 'Disconnect and reload',
      dismissable: false,
    });
  }

  @action
  onLayer2Incorrect() {
    // don't allow layer 2 modal options to override layer 1
    if (this.chainChangeModalOptions) return;
    this.showChainChangeModal({
      ...networkCorrectionMessages.layer2,
      onClose: this.hideChainChangeModal,
      action: this.hideChainChangeModal,
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
  showChainChangeModal(options: ChainChangeModalOptions) {
    this.chainChangeModalOptions = options;
  }

  @action
  hideChainChangeModal() {
    this.chainChangeModalOptions = null;
  }

  @action transitionTo(routeName: string) {
    this.transitionToRoute(routeName);
  }
}
