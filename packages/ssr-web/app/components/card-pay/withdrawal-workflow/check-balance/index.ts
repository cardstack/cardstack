import Component from '@glimmer/component';
import { WorkflowCardComponentArgs } from '@cardstack/ssr-web/models/workflow';
import { next } from '@ember/runloop';
import { inject as service } from '@ember/service';
import Layer1Network from '@cardstack/ssr-web/services/layer1-network';
import {
  BridgeableSymbol,
  TokenDisplayInfo,
} from '@cardstack/ssr-web/utils/token';
import { reads } from 'macro-decorators';
import { WalletProvider } from '@cardstack/ssr-web/utils/wallet-providers';
import { taskFor } from 'ember-concurrency-ts';
import { task } from 'ember-concurrency-decorators';
import { timeout } from 'ember-concurrency';
import config from '@cardstack/ssr-web/config/environment';
import BN from 'bn.js';

const BALANCE_CHECK_INTERVAL = config.environment === 'test' ? 100 : 5000;

export default class CardPayWithdrawalWorkflowCheckBalanceComponent extends Component<WorkflowCardComponentArgs> {
  constructor(owner: unknown, args: WorkflowCardComponentArgs) {
    super(owner, args);
    if (this.hasSufficientBalance) {
      next(this, () => {
        this.args.onComplete?.();
      });
    } else {
      taskFor(this.waitForSufficientBalanceTask).perform();
    }
  }

  @task
  *waitForSufficientBalanceTask() {
    while (!this.hasSufficientBalance) {
      yield timeout(BALANCE_CHECK_INTERVAL);
      this.layer1Network.refreshBalances();
    }
    next(this, () => {
      this.args.onComplete?.();
    });
  }

  @service declare layer1Network: Layer1Network;
  @reads('layer1Network.walletProvider') declare walletProvider: WalletProvider;

  get hasSufficientBalance() {
    return (
      this.layer1Network.defaultTokenBalance &&
      this.minimumBalanceForWithdrawalClaim.lte(
        this.layer1Network.defaultTokenBalance
      )
    );
  }

  get header() {
    return `Check ${this.layer1Network.nativeTokenSymbol} balance`;
  }

  get nativeTokenDisplayInfo(): TokenDisplayInfo<BridgeableSymbol> | undefined {
    return new TokenDisplayInfo(
      this.layer1Network.nativeTokenSymbol as BridgeableSymbol
    );
  }

  get minimumBalanceForWithdrawalClaim(): BN {
    return this.args.workflowSession.getValue(
      'minimumBalanceForWithdrawalClaim'
    )!;
  }
}
