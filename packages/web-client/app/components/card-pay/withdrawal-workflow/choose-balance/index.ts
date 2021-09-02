import Component from '@glimmer/component';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import Layer1Network from '@cardstack/web-client/services/layer1-network';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import { TokenBalance, TokenSymbol } from '@cardstack/web-client/utils/token';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow/workflow-card';
import { Safe } from '@cardstack/cardpay-sdk/sdk/safes';
import BN from 'bn.js';

class CardPayWithdrawalWorkflowChooseBalanceComponent extends Component<WorkflowCardComponentArgs> {
  compatibleSafeTypes = ['depot', 'merchant'];

  defaultTokenSymbol: TokenSymbol = 'DAI.CPXD';
  cardTokenSymbol: TokenSymbol = 'CARD.CPXD';
  tokenOptions = [this.defaultTokenSymbol, this.cardTokenSymbol];
  @service declare layer1Network: Layer1Network;
  @service declare layer2Network: Layer2Network;
  get somethingTokenSymbolFIXME(): TokenSymbol {
    return (
      this.args.workflowSession.state.withdrawalToken ?? this.defaultTokenSymbol
    );
  }

  @tracked selectedSafe: Safe | undefined;
  @tracked selectedTokenSymbol: TokenSymbol;

  constructor(owner: unknown, args: WorkflowCardComponentArgs) {
    super(owner, args);
    this.selectedSafe = this.layer2Network.depotSafe;
    this.selectedTokenSymbol =
      this.tokens.find((t) => t.symbol === this.somethingTokenSymbolFIXME)
        ?.tokenDisplayInfo.symbol ?? this.tokens[0].tokenDisplayInfo.symbol;
  }

  get depotAddress() {
    return this.layer2Network.depotSafe?.address || undefined;
  }

  get compatibleSafes() {
    return this.layer2Network.safes.value.filter((safe) =>
      this.compatibleSafeTypes.includes(safe.type)
    );
  }

  get tokens() {
    return this.tokenOptions.map((symbol) => {
      let truncatedSymbol = symbol.split('.')[0];
      let selectedSafeToken = (this.selectedSafe?.tokens || []).find(
        // FIXME how to get symbol with no suffix?
        (token) => token.token.symbol === truncatedSymbol
      );
      let balance = new BN(selectedSafeToken?.balance || '0');
      return new TokenBalance(symbol, balance);
    });
  }

  get selectedToken() {
    return this.tokens.find(
      (token) => token.symbol === this.selectedTokenSymbol
    );
  }

  get isDisabled() {
    return (
      !this.depotAddress ||
      !this.tokens.length ||
      !this.selectedToken?.balance ||
      this.selectedToken?.balance.isZero()
    );
  }

  @action chooseSafe(safe: Safe) {
    this.selectedSafe = safe;
  }

  @action chooseSource(token: TokenBalance) {
    this.selectedTokenSymbol = token.symbol;
  }

  @action save() {
    if (this.isDisabled) {
      return;
    }
    if (this.selectedToken) {
      this.args.workflowSession.update(
        'withdrawalToken',
        this.selectedToken.symbol
      );
      this.args.onComplete?.();
    }
  }
}

export default CardPayWithdrawalWorkflowChooseBalanceComponent;
