import Component from '@glimmer/component';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import { TokenBalance, TokenSymbol } from '@cardstack/web-client/utils/token';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow/workflow-card';
import { toBN } from 'web3-utils';

class CardPayWithdrawalWorkflowChooseBalanceComponent extends Component<WorkflowCardComponentArgs> {
  defaultTokenSymbol: TokenSymbol = 'DAI.CPXD';
  cardTokenSymbol: TokenSymbol = 'CARD.CPXD';
  tokenOptions = [this.defaultTokenSymbol, this.cardTokenSymbol];
  @service declare layer2Network: Layer2Network;
  @tracked selectedTokenSymbol: TokenSymbol =
    this.args.workflowSession.state.withdrawalToken ?? this.defaultTokenSymbol;
  @tracked selectedToken: TokenBalance;

  constructor(owner: unknown, args: WorkflowCardComponentArgs) {
    super(owner, args);
    this.selectedToken =
      this.tokens.find((t) => t.symbol === this.selectedTokenSymbol) ??
      this.tokens[0];
  }

  get depotAddress() {
    return this.layer2Network.depotSafe?.address || undefined;
  }

  get tokens() {
    return this.tokenOptions.map((symbol) => {
      let balance = this.getTokenBalance(symbol);
      return new TokenBalance(symbol, balance);
    });
  }

  getTokenBalance(symbol: TokenSymbol) {
    if (symbol === this.defaultTokenSymbol) {
      return this.layer2Network.defaultTokenBalance ?? toBN('0');
    }
    if (symbol === this.cardTokenSymbol) {
      return this.layer2Network.cardBalance ?? toBN('0');
    }
    return toBN('0');
  }

  get isDisabled() {
    return (
      !this.depotAddress ||
      !this.tokens.length ||
      !this.selectedToken.balance ||
      this.selectedToken.balance.isZero()
    );
  }

  @action chooseSource(token: TokenBalance) {
    this.selectedToken = token;
  }

  @action save() {
    if (this.isDisabled) {
      return;
    }
    if (this.selectedTokenSymbol) {
      this.args.workflowSession.update(
        'withdrawalToken',
        this.selectedTokenSymbol
      );
    }
    this.args.onComplete?.();
  }
}

export default CardPayWithdrawalWorkflowChooseBalanceComponent;
