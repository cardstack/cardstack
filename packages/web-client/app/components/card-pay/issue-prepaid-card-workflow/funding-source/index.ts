import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import BN from 'bn.js';
import { fromWei } from 'web3-utils';

import { Safe } from '@cardstack/cardpay-sdk';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import {
  TokenBalance,
  BridgedTokenSymbol,
} from '@cardstack/web-client/utils/token';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow';

class FundingSourceCard extends Component<WorkflowCardComponentArgs> {
  compatibleSafeTypes = ['depot', 'merchant'];

  defaultTokenSymbol: BridgedTokenSymbol;
  tokenOptions: BridgedTokenSymbol[];
  minimumDaiValue: BN;
  @service declare layer2Network: Layer2Network;

  @tracked selectedSafe: Safe | undefined;
  @tracked selectedTokenSymbol: BridgedTokenSymbol;

  constructor(owner: unknown, args: WorkflowCardComponentArgs) {
    super(owner, args);
    this.defaultTokenSymbol = this.layer2Network.defaultTokenSymbol;
    this.tokenOptions = [this.defaultTokenSymbol];

    this.minimumDaiValue = new BN(
      this.args.workflowSession.getValue<string>('daiMinValue')!
    );

    let prepaidFundingSafeAddress = this.args.workflowSession.getValue<string>(
      'prepaidFundingSafeAddress'
    );

    let safeToSelect = prepaidFundingSafeAddress
      ? this.layer2Network.safes.getByAddress(prepaidFundingSafeAddress)
      : this.layer2Network.depotSafe;

    if (
      (safeToSelect && !this.sufficientBalanceSafes.includes(safeToSelect)) ||
      !safeToSelect
    ) {
      safeToSelect = this.sufficientBalanceSafes[0];
    }

    this.selectedSafe = safeToSelect;

    this.selectedTokenSymbol =
      this.tokens.find((t) => t.symbol === this.prepaidFundingToken)
        ?.tokenDisplayInfo.symbol ?? this.tokens[0].tokenDisplayInfo.symbol;
  }

  get prepaidFundingToken(): BridgedTokenSymbol {
    return (
      this.args.workflowSession.getValue('prepaidFundingToken') ??
      this.defaultTokenSymbol
    );
  }

  get sufficientBalanceSafes() {
    return this.layer2Network.safes.issuePrepaidCardSourceSafes;
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
      !this.tokens.length ||
      !this.selectedToken?.balance ||
      this.selectedToken?.balance.isZero()
    );
  }

  get formattedMinimumDaiValue() {
    return Math.ceil(Number(fromWei(this.minimumDaiValue)));
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
    if (this.selectedTokenSymbol) {
      this.args.workflowSession.setValue({
        prepaidFundingToken: this.selectedTokenSymbol,
        prepaidFundingSafeAddress: this.selectedSafe!.address,
      });
    }
    this.args.onComplete?.();
  }
}

export default FundingSourceCard;
