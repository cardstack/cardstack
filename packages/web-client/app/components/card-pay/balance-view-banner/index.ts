import Component from '@glimmer/component';
import BN from 'bn.js';

import { Profile } from '@cardstack/web-client/resources/profile';
import { MerchantSafe, Safe } from '@cardstack/cardpay-sdk';
import {
  BridgedTokenSymbol,
  TokenDisplayInfo,
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

    let balance = safe.tokens.find(
      (token) => token.token.symbol === tokenSymbol
    )?.balance;

    return balance ? new BN(balance) : new BN(0);
  }

  get safeIcon() {
    let safeType = this.args.safe.type;
    if (this.supportedSafeTypes.includes(safeType)) {
      return safeType === 'merchant' ? 'profile' : safeType;
    } else {
      return null;
    }
  }

  get tokenIcon() {
    return TokenDisplayInfo.iconFor(this.args.token);
  }

  get summaryBalanceLabel() {
    if (this.args.safe.type === 'merchant') {
      if (this.profile.loading) {
        return `Payment Profile`;
      } else {
        return `Payment Profile ${this.profile.name}`;
      }
    } else if (this.args.safe.type === 'depot') {
      return 'DEPOT';
    } else {
      return 'Safe';
    }
  }

  profile = Profile.from(this, () => ({
    infoDID: (this.args.safe as MerchantSafe).infoDID,
  }));
}

export default BalanceViewBannerComponent;
