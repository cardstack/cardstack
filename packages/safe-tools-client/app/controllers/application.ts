import { convertChainIdToName } from '@cardstack/cardpay-sdk';
import Controller from '@ember/controller';
import { service } from '@ember/service';
import { tracked } from '@glimmer/tracking';

import NetworkService from '../services/network';
import WalletService from '../services/wallet';

export default class ApplicationController extends Controller {
  @tracked isShowingConnectModal = false;
  @service declare network: NetworkService;
  @service declare wallet: WalletService;

  get providerName() {
    return this.wallet.unsupportedConnectCache?.providerId === 'metamask'
      ? 'Metamask'
      : 'WalletConnect';
  }

  get networkName() {
    const chainId = this.wallet.unsupportedConnectCache?.chainId;
    let networkName;
    if (chainId) {
      networkName = convertChainIdToName(chainId);
    }
    if (!networkName) {
      networkName = 'an unknown';
    }
    return networkName;
  }
}

declare module '@ember/controller' {
  interface Registry {
    application: ApplicationController;
  }
}
