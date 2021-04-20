import { action } from '@ember/object';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { task } from 'ember-concurrency-decorators';
import Layer1Network from '../../../../services/layer1-network';
import { inject as service } from '@ember/service';
import { taskFor } from 'ember-concurrency-ts';
import { reads } from 'macro-decorators';
import { next } from '@ember/runloop';
import walletProviders from '../../../../utils/wallet-providers';

import cardstackLogo from '@cardstack/web-client/images/icons/cardstack-logo-navy-rounded.svg';
import connectionSymbol from '@cardstack/web-client/images/icons/connection-symbol.svg';
import { WalletProvider } from '../../../../utils/wallet-providers';

interface CardPayDepositWorkflowConnectLayer1ComponentArgs {
  onComplete: (() => void) | undefined;
}
class CardPayDepositWorkflowConnectLayer1Component extends Component<CardPayDepositWorkflowConnectLayer1ComponentArgs> {
  cardstackLogo = cardstackLogo;
  connectionSymbol = connectionSymbol;
  walletProviders = walletProviders;

  @service declare layer1Network: Layer1Network;
  @reads('layer1Network.hasAccount') declare hasAccount: boolean;
  @tracked isWaitingForConnection = false;
  @tracked currentWalletProviderId = '';

  constructor(
    owner: unknown,
    args: CardPayDepositWorkflowConnectLayer1ComponentArgs
  ) {
    super(owner, args);
    if (this.hasAccount) {
      next(this, () => {
        this.args.onComplete?.();
      });
    }
  }
  get currentWalletProvider(): WalletProvider | undefined {
    return this.walletProviders.find(
      (walletProvider) => walletProvider.id === this.currentWalletProviderId
    );
  }
  get currentWalletLogo(): string {
    let { currentWalletProvider } = this;
    if (currentWalletProvider) return currentWalletProvider.logo;
    else return '';
  }
  get cardState(): string {
    if (this.hasAccount) {
      return 'memorialized';
    } else if (this.isWaitingForConnection) {
      return 'in-progress';
    } else {
      return 'default';
    }
  }
  @action changeWalletProvider(e: Event): void {
    this.currentWalletProviderId = (e.target as HTMLInputElement).id;
  }
  @action connect() {
    if (!this.hasAccount) {
      taskFor(this.connectWalletTask).perform();
    }
  }
  @action cancelConnection() {
    // TODO after connectors are added
  }
  @action disconnect() {
    // TODO after connectors are added
  }
  @task *connectWalletTask() {
    this.isWaitingForConnection = true;
    if (this.currentWalletProvider) {
      yield this.layer1Network.connect(this.currentWalletProvider);
    }
    this.isWaitingForConnection = false;
    this.args.onComplete?.();
  }
}

export default CardPayDepositWorkflowConnectLayer1Component;
