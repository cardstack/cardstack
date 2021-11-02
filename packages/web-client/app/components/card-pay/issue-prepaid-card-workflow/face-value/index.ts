import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import { Safe } from '@cardstack/cardpay-sdk/sdk/safes';
import { fromWei } from 'web3-utils';
import BN from 'bn.js';
import {
  BridgedTokenSymbol,
  TokenDisplayInfo,
} from '@cardstack/web-client/utils/token';
import { faceValueOptions } from '../index';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow';

interface FaceValue {
  spendAmount: number;
  approxTokenAmount: number;
  isOptionDisabled: boolean;
}

class FaceValueCard extends Component<WorkflowCardComponentArgs> {
  faceValueOptions = faceValueOptions;

  @service declare layer2Network: Layer2Network;
  get fundingTokenSymbol(): BridgedTokenSymbol {
    return this.args.workflowSession.getValue('prepaidFundingToken')!;
  }
  @tracked selectedFaceValue?: FaceValue;
  @tracked options: FaceValue[] = [];

  @action async prepareFaceValueOptions() {
    this.options = await Promise.all(
      this.faceValueOptions.map(async (spendAmount) => {
        let result: string = await this.layer2Network.convertFromSpend(
          this.layer2Network.bridgedDaiTokenSymbol,
          spendAmount
        );
        let approxTokenAmount = Math.ceil(parseFloat(fromWei(result))); // for display only
        return {
          spendAmount,
          approxTokenAmount,
          isOptionDisabled: this.fundingTokenBalance.lt(new BN(result)),
        };
      })
    );

    const defaultSpendAmount =
      this.args.workflowSession.getValue<number>('spendFaceValue');
    if (defaultSpendAmount) {
      this.selectedFaceValue = this.options.findBy(
        'spendAmount',
        defaultSpendAmount
      );
    }
  }

  get fundingSafe(): Safe {
    return this.layer2Network.safes.getByAddress(
      this.args.workflowSession.getValue<string>('prepaidFundingSafeAddress')!
    )!;
  }

  get fundingTokenBalance(): BN {
    let safe = this.fundingSafe;
    let tokenSymbol = this.fundingTokenSymbol;

    let balance = safe.tokens.find(
      (token) => token.token.symbol === tokenSymbol
    )?.balance;

    return balance ? new BN(balance) : new BN(0);
  }

  get fundingToken() {
    if (this.fundingTokenSymbol) {
      return new TokenDisplayInfo(this.fundingTokenSymbol);
    }
    return undefined;
  }

  get isDisabled() {
    if (
      !this.selectedFaceValue?.spendAmount ||
      !this.fundingTokenBalance ||
      this.fundingTokenBalance.isZero()
    ) {
      return true;
    }
    return this.selectedFaceValue.isOptionDisabled;
  }

  @action chooseFaceValue(val: FaceValue) {
    this.selectedFaceValue = val;
  }

  @action save() {
    if (this.isDisabled) {
      return;
    }
    let amount = this.selectedFaceValue?.spendAmount;
    if (amount) {
      this.args.workflowSession.setValue('spendFaceValue', amount);
    }
    this.args.onComplete?.();
  }
}

export default FaceValueCard;
