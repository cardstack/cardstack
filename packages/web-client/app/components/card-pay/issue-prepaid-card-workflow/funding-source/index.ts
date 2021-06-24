import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import { toBN } from 'web3-utils';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import WorkflowSession from '@cardstack/web-client/models/workflow/workflow-session';
import {
  TokenDisplayInfo,
  TokenSymbol,
} from '@cardstack/web-client/utils/token';
import { Token } from '../workflow-config';

interface FundingSourceCardArgs {
  workflowSession: WorkflowSession;
  onComplete: (() => void) | undefined;
  onIncomplete: (() => void) | undefined;
  isComplete: boolean;
}

class FundingSourceCard extends Component<FundingSourceCardArgs> {
  defaultTokenSymbol: TokenSymbol = 'DAI.CPXD';
  defaultTokenInfo = new TokenDisplayInfo(this.defaultTokenSymbol);
  @service declare layer2Network: Layer2Network;
  @tracked selectedToken: Token =
    (this.args.workflowSession.state.prepaidFundingToken as Token) ??
    this.defaultToken;

  constructor(owner: unknown, args: FundingSourceCardArgs) {
    super(owner, args);
  }

  get depotAddress() {
    return this.layer2Network.depotSafe?.address || undefined;
  }

  get defaultToken(): Token {
    return {
      ...this.defaultTokenInfo,
      balance: this.layer2Network.defaultTokenBalance ?? toBN('0'),
    };
  }

  get tokens(): Token[] {
    return [this.defaultToken];
  }

  get isDisabled() {
    return (
      !this.depotAddress ||
      !this.tokens.length ||
      !this.selectedToken.balance ||
      this.selectedToken.balance.isZero()
    );
  }

  @action chooseSource(token: Token) {
    this.selectedToken = token;
  }

  @action save() {
    if (this.isDisabled) {
      return;
    }
    if (this.selectedToken) {
      this.args.workflowSession.update(
        'prepaidFundingToken',
        this.selectedToken
      );
    }
    this.args.onComplete?.();
  }
}

export default FundingSourceCard;
