import Component from '@glimmer/component';
import { capitalize } from '@ember/string';
import Layer2Network from '../../../services/layer2-network';
import { inject as service } from '@ember/service';
import { reads } from 'macro-decorators';
import { next } from '@ember/runloop';
import { action } from '@ember/object';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow';
import {
  BridgeableSymbol,
  TokenBalance,
  getBridgedSymbol,
} from '@cardstack/web-client/utils/token';
import BN from 'bn.js';

interface CardPaySafeBalanceCardComponentArgs
  extends WorkflowCardComponentArgs {
  onConnect: (() => void) | undefined;
  onDisconnect: (() => void) | undefined;
  config: {
    safeAddressKey: string;
  };
}

class CardPaySafeBalanceCardComponent extends Component<CardPaySafeBalanceCardComponentArgs> {
  @service declare layer2Network: Layer2Network;
  @reads('layer2Network.isConnected') declare isConnected: boolean;

  constructor(owner: unknown, args: CardPaySafeBalanceCardComponentArgs) {
    super(owner, args);

    if (!this.safeAddress) {
      throw new Error(
        `CardPay::SafeBalanceCard requires the "${this.args.config.safeAddressKey}" referenced by safeBalanceCardKey in the workflow session`
      );
    }

    if (this.isConnected) {
      next(this, () => {
        this.args.onComplete?.();
      });
    }
  }

  get safeAddress() {
    return this.args.workflowSession.getValue<string>(
      this.args.config.safeAddressKey
    );
  }

  get safe() {
    return this.layer2Network.safes.getByAddress(this.safeAddress!)!;
  }

  get safeLabel() {
    let safeType = this.safe.type;
    return `${capitalize(safeType).replace(/-/g, ' ')} balance`;
  }

  get balancesToShow() {
    return this.safe.tokens
      .map((token) => {
        let bridgedSymbol = getBridgedSymbol(
          token.token.symbol as BridgeableSymbol
        );
        let balance = new BN(token.balance || '0');
        return new TokenBalance(bridgedSymbol, balance);
      })
      .filter((tokenBalance) => !tokenBalance.balance.isZero());
  }

  @action onDisconnect() {
    this.args.onDisconnect?.();
  }

  get cardState(): string {
    if (this.isConnected || this.args.isComplete) {
      return 'memorialized';
    } else {
      return 'default';
    }
  }
}

export default CardPaySafeBalanceCardComponent;

declare module '@cardstack/web-client/models/workflow/workflow-card' {
  interface CardConfiguration {
    'card-pay/safe-balance-card': CardPaySafeBalanceCardComponentArgs['config'];
  }
}
