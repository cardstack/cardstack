import { action } from '@ember/object';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { task } from 'ember-concurrency-decorators';
import Layer1Network from '@cardstack/web-client/services/layer1-network';
import { inject as service } from '@ember/service';
import { taskFor } from 'ember-concurrency-ts';
import { timeout } from 'ember-concurrency';
import { reads } from 'macro-decorators';
import { next } from '@ember/runloop';
import walletProviders from '@cardstack/web-client/utils/wallet-providers';

import cardstackLogo from '@cardstack/web-client/images/icons/cardstack-logo-navy-rounded.svg';
import connectionSymbol from '@cardstack/web-client/images/icons/connection-symbol.svg';
import { WalletProvider } from '@cardstack/web-client/utils/wallet-providers';

interface CardPayDepositWorkflowConnectLayer1ComponentArgs {
  onComplete: (() => void) | undefined;
  onIncomplete: (() => void) | undefined;
  onConnect: (() => void) | undefined;
  onDisconnect: (() => void) | undefined;
  isComplete: boolean;
}
class CardPayDepositWorkflowConnectLayer1Component extends Component<CardPayDepositWorkflowConnectLayer1ComponentArgs> {
  cardstackLogo = cardstackLogo;
  connectionSymbol = connectionSymbol;
  walletProviders = walletProviders;

  @service declare layer1Network: Layer1Network;
  @reads('layer1Network.hasAccount') declare hasAccount: boolean;
  @tracked isWaitingForConnection = false;
  /*
     Set a starting wallet provider for the focus trap library in the modal
     - focus trapping requires checking what the next tabbable element is
     - radios with their roving tabindex confuse tabbable, so they cannot be the last focusable element
       , otherwise focus leaves the page
     - selecting a radio makes the connect button enabled and focusable.
   */
  @tracked radioWalletProviderId = 'metamask';

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
  get connectedWalletProvider(): WalletProvider | undefined {
    if (!this.hasAccount) return undefined;
    else
      return this.walletProviders.find(
        (walletProvider) =>
          walletProvider.id === this.layer1Network.strategy.currentProviderId
      );
  }
  get connectedWalletLogo(): string {
    if (this.connectedWalletProvider) return this.connectedWalletProvider.logo;
    else return '';
  }

  get ctaState(): string {
    if (this.hasAccount) {
      return 'memorialized';
    } else if (this.isWaitingForConnection) {
      return 'in-progress';
    } else if (!this.radioWalletProviderId) {
      return 'disabled';
    } else {
      return 'default';
    }
  }

  @action changeWalletProvider(id: string): void {
    this.radioWalletProviderId = id;
  }
  @action connect() {
    if (!this.hasAccount) {
      taskFor(this.connectWalletTask).perform();
    }
  }
  @action cancelConnection() {
    // given the way users connect, I don't think we need to do anything else here
    // since most of the other actions are delegated to the user + browser plugins
    // so we can't control it anyway. The situation where the corresponding button is visible is
    // usually when the user decides not to complete the connection by closing connection
    // prompt ui without taking action.
    this.isWaitingForConnection = false;
  }
  @action disconnect() {
    this.layer1Network.disconnect();
    this.args.onDisconnect?.();
    this.args.onIncomplete?.();
  }

  @task *connectWalletTask() {
    this.isWaitingForConnection = true;
    if (this.radioWalletProviderId) {
      yield this.layer1Network.connect({
        id: this.radioWalletProviderId,
      } as WalletProvider);
    }
    this.isWaitingForConnection = false;
    yield timeout(500); // allow time for strategy to verify connected chain -- it might not accept the connection
    if (this.hasAccount) {
      this.args.onConnect?.();
      this.args.onComplete?.();
    }
  }
}

export default CardPayDepositWorkflowConnectLayer1Component;
