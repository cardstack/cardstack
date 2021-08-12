import Component from '@glimmer/component';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow/workflow-card';
import { next } from '@ember/runloop';
import { inject as service } from '@ember/service';
import Layer1Network from '@cardstack/web-client/services/layer1-network';
import {
  TokenDisplayInfo,
  TokenSymbol,
} from '@cardstack/web-client/utils/token';
import { reads } from 'macro-decorators';
import { WalletProvider } from '@cardstack/web-client/utils/wallet-providers';

export default class CardPayWithdrawalWorkflowCheckBalanceComponent extends Component<WorkflowCardComponentArgs> {
  constructor(owner: unknown, args: WorkflowCardComponentArgs) {
    super(owner, args);
    if (
      this.minimumBalanceForWithdrawalClaim.lte(
        this.layer1Network.defaultTokenBalance
      )
    ) {
      next(this, () => {
        this.args.onComplete?.();
      });
    }
  }

  @service declare layer1Network: Layer1Network;
  @reads('layer1Network.walletProvider') declare walletProvider: WalletProvider;

  get header() {
    return `Check ${this.layer1Network.nativeTokenSymbol} balance`;
  }

  get nativeTokenDisplayInfo(): TokenDisplayInfo | undefined {
    return new TokenDisplayInfo(
      this.layer1Network.nativeTokenSymbol as TokenSymbol
    );
  }
  get minimumBalanceForWithdrawalClaim() {
    return this.args.workflowSession.state['minimumBalanceForWithdrawalClaim'];
  }
}
