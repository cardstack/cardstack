import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import BN from 'bn.js';

import { Safe } from '@cardstack/cardpay-sdk/sdk/safes';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import {
  TokenBalance,
  BridgedTokenSymbol,
  getBridgedSymbol,
  getUnbridgedSymbol,
  BridgeableSymbol,
} from '@cardstack/web-client/utils/token';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow';

class FundingSourceCard extends Component<WorkflowCardComponentArgs> {
  compatibleSafeTypes = ['depot', 'merchant'];

  defaultTokenSymbol: BridgedTokenSymbol = 'DAI.CPXD';
  tokenOptions = [this.defaultTokenSymbol];
  minimumFaceValue: BN;
  @service declare layer2Network: Layer2Network;

  @tracked selectedSafe: Safe | undefined;
  @tracked selectedTokenSymbol: BridgedTokenSymbol;

  constructor(owner: unknown, args: WorkflowCardComponentArgs) {
    super(owner, args);

    this.minimumFaceValue = new BN(
      this.args.workflowSession.getValue<string>('daiMinValue')!
    );

    let prepaidFundingSafeAddress = this.args.workflowSession.getValue<string>(
      'prepaidFundingSafeAddress'
    );
    this.selectedSafe = prepaidFundingSafeAddress
      ? this.layer2Network.safes.getByAddress(prepaidFundingSafeAddress)
      : this.layer2Network.depotSafe;

    // FIXME this could change the selected safe if the stored one is now underfunded…
    if (
      (this.selectedSafe &&
        !this.sufficientBalanceSafes.includes(this.selectedSafe)) ||
      !this.selectedSafe
    ) {
      this.selectedSafe = this.sufficientBalanceSafes[0];
    }

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

  get depotAddress() {
    return this.layer2Network.depotSafe?.address || undefined;
  }

  get compatibleSafes() {
    return this.layer2Network.safes.value.filter((safe) =>
      this.compatibleSafeTypes.includes(safe.type)
    );
  }

  get sufficientBalanceSafes() {
    return this.compatibleSafes.filter((safe) => {
      let compatibleTokens = safe.tokens.filter((token) =>
        this.tokenOptions.includes(
          getBridgedSymbol(token.token.symbol as BridgeableSymbol)
        )
      );

      return compatibleTokens.any((token) =>
        this.minimumFaceValue.lte(new BN(token.balance))
      );
    });
  }

  get tokens() {
    return this.tokenOptions.map((symbol) => {
      let unbridgedSymbol = getUnbridgedSymbol(symbol);
      let selectedSafeToken = (this.selectedSafe?.tokens || []).find(
        (token) => token.token.symbol === unbridgedSymbol
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
    if (this.selectedTokenSymbol) {
      this.args.workflowSession.setValue({
        prepaidFundingToken: this.selectedTokenSymbol,
        prepaidFundingSafeAddress: this.selectedSafe!.address,
        safeBalanceCardKey: 'prepaidFundingSafeAddress',
      });
    }
    this.args.onComplete?.();
  }
}

export default FundingSourceCard;
