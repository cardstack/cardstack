import Controller from '@ember/controller';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import Layer1Network from '@cardstack/web-client/services/layer1-network';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import { tracked } from '@glimmer/tracking';
import { currentNetworkDisplayInfo as c } from '../utils/web3-strategies/network-display-info';

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
  @tracked layer1Incorrect = false;
  @tracked layer2Incorrect = false;
  @tracked needsReload = false;
  @tracked isShowingChainChangeModal = false;

  constructor() {
    super(...arguments);

    this.layer1Network.on('correct-chain', this.maybeReload);
    this.layer1Network.on('disconnect', this.maybeReload);
    this.layer1Network.on('incorrect-chain', this.onLayer1Incorrect);

    this.layer2Network.on('incorrect-chain', this.onLayer2Incorrect);
  }

  get chainChangeModalLayer() {
    if (this.layer1Incorrect) return 'layer1';
    else if (this.layer2Incorrect) return 'layer2';
    else return '';
  }

  get chainChangeModalTitle() {
    if (!this.chainChangeModalLayer) return '';
    return networkCorrectionMessages[this.chainChangeModalLayer].title;
  }

  get chainChangeModalBody() {
    if (!this.chainChangeModalLayer) return '';
    return networkCorrectionMessages[this.chainChangeModalLayer].body;
  }

  @action
  onLayer1Incorrect() {
    this.needsReload = true;
    this.layer1Incorrect = true;
    this.showChainChangeModal();
  }

  @action
  onLayer2Incorrect() {
    this.layer2Incorrect = true;
    this.showChainChangeModal();
  }

  @action
  maybeReload() {
    if (!this.needsReload) {
      console.log('do not need to reload via service');
      return;
    }

    console.log('reloading via service');
  }

  @action
  showChainChangeModal() {
    this.isShowingChainChangeModal = true;
  }

  @action
  hideChainChangeModal() {
    if (!this.needsReload) this.isShowingChainChangeModal = false;
  }

  @action transitionTo(routeName: string) {
    this.transitionToRoute(routeName);
  }
}
