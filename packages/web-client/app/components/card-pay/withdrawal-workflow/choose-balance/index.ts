import Component from '@glimmer/component';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import Layer1Network from '@cardstack/web-client/services/layer1-network';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import {
  TokenBalance,
  BridgedTokenSymbol,
} from '@cardstack/web-client/utils/token';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow';
import { Safe } from '@cardstack/cardpay-sdk/sdk/safes';
import BN from 'bn.js';
import { reads } from 'macro-decorators';

class CardPayWithdrawalWorkflowChooseBalanceComponent extends Component<WorkflowCardComponentArgs> {
  compatibleSafeTypes = ['depot', 'merchant'];

  @reads('layer2Network.defaultTokenSymbol')
  defaultTokenSymbol!: BridgedTokenSymbol;
  @reads('layer2Network.bridgedCardTokenSymbol')
  bridgedCardTokenSymbol!: BridgedTokenSymbol;
  tokenOptions = [this.defaultTokenSymbol, this.bridgedCardTokenSymbol];
  @service declare layer1Network: Layer1Network;
  @service declare layer2Network: Layer2Network;

  @tracked selectedSafe: Safe | undefined;
  @tracked selectedTokenSymbol: BridgedTokenSymbol;

  constructor(owner: unknown, args: WorkflowCardComponentArgs) {
    super(owner, args);
    let withdrawalSafeAddress =
      this.args.workflowSession.getValue<string>('withdrawalSafe');
    this.selectedSafe = withdrawalSafeAddress
      ? this.layer2Network.safes.getByAddress(withdrawalSafeAddress)
      : this.layer2Network.depotSafe;
    this.selectedTokenSymbol =
      this.tokens.find((t) => t.symbol === this.withdrawalToken)
        ?.tokenDisplayInfo.symbol ?? this.tokens[0].tokenDisplayInfo.symbol;
  }

  get withdrawalToken(): BridgedTokenSymbol {
    return (
      this.args.workflowSession.getValue('withdrawalToken') ??
      this.defaultTokenSymbol
    );
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
      let selectedSafeToken = (this.selectedSafe?.tokens || []).find(
        (token) => token.token.symbol === symbol
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

  @action chooseBalance(token: TokenBalance<BridgedTokenSymbol>) {
    this.selectedTokenSymbol = token.symbol;
  }

  @action save() {
    if (this.isDisabled) {
      return;
    }
    if (this.selectedToken) {
      this.args.workflowSession.setValue({
        withdrawalSafe: this.selectedSafe!.address,
        withdrawalToken: this.selectedToken.symbol,
      });
      this.args.onComplete?.();
    }
  }
}

export default CardPayWithdrawalWorkflowChooseBalanceComponent;
