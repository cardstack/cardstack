import Component from '@glimmer/component';
import BN from 'bn.js';

import { MerchantInfo } from '@cardstack/web-client/resources/merchant-info';
import { MerchantSafe, Safe } from '@cardstack/cardpay-sdk';
import { useResource } from 'ember-resources';
import {
  BridgedTokenSymbol,
  TokenDisplayInfo,
  getUnbridgedSymbol,
} from '@cardstack/web-client/utils/token';

interface BalanceViewBannerComponentArgs {
  walletAddress: string;
  safe: Safe;
  token: BridgedTokenSymbol;
}

class BalanceViewBannerComponent extends Component<BalanceViewBannerComponentArgs> {
  supportedSafeTypes = ['depot', 'merchant'];

  get tokenBalance(): BN {
    let safe = this.args.safe;
    let tokenSymbol = this.args.token;
    let unbridgedSymbol = getUnbridgedSymbol(tokenSymbol);
    // SDK returns bridged token symbols without the CPXD suffix

    let balance = safe.tokens.find(
      (token) => token.token.symbol === unbridgedSymbol
    )?.balance;

    return balance ? new BN(balance) : new BN(0);
  }

  get safeIcon() {
    if (this.supportedSafeTypes.includes(this.args.safe.type)) {
      return this.args.safe.type;
    } else {
      return null;
    }
  }

  get tokenIcon() {
    return TokenDisplayInfo.iconFor(this.args.token);
  }

  get summaryBalanceLabel() {
    if (this.args.safe.type === 'merchant') {
      if (this.merchantInfo.loading) {
        return `Merchant`;
      } else {
        return `Merchant ${this.merchantInfo.name}`;
      }
    } else if (this.args.safe.type === 'depot') {
      return 'DEPOT';
    } else {
      return 'Unknown';
    }
  }

  merchantInfo = useResource(this, MerchantInfo, () => ({
    infoDID: (this.args.safe as MerchantSafe).infoDID,
  }));
}

export default BalanceViewBannerComponent;
