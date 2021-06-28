import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { reads } from 'macro-decorators';
import { inject as service } from '@ember/service';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import { fromWei, toBN, toWei } from 'web3-utils';
import BN from 'web3-core/node_modules/@types/bn.js';
import {
  ConvertibleSymbol,
  TokenDisplayInfo,
  TokenSymbol,
} from '@cardstack/web-client/utils/token';
import { faceValueOptions, spendToUsdRate } from '../workflow-config';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow/workflow-card';

interface FaceValue {
  spendAmount: number;
  tokenAmount: string;
}

class FaceValueCard extends Component<WorkflowCardComponentArgs> {
  faceValueOptions = faceValueOptions;
  spendToUsdRate = spendToUsdRate;

  @service declare layer2Network: Layer2Network;
  @reads('args.workflowSession.state.prepaidFundingToken')
  declare fundingTokenSymbol: TokenSymbol;
  @tracked selectedFaceValue?: FaceValue;
  @tracked options: FaceValue[] = [];

  constructor(owner: unknown, args: WorkflowCardComponentArgs) {
    super(owner, args);
    this.getTokenAmounts('DAI', this.faceValueOptions);
  }

  async getTokenAmounts(symbol: ConvertibleSymbol, spendArr: number[]) {
    spendArr.map(async (spendAmount) => {
      let result = await this.layer2Network.convertFromSpend(
        symbol,
        spendAmount
      );
      let tokenAmount = parseFloat(fromWei(result)).toFixed(2);
      this.options = [
        ...this.options,
        {
          spendAmount,
          tokenAmount,
        },
      ];
    });
  }

  get fundingTokenBalance(): BN {
    if (this.fundingTokenSymbol === 'DAI.CPXD') {
      return this.layer2Network.defaultTokenBalance ?? toBN('0');
    }
    return toBN('0');
  }

  get fundingToken() {
    if (this.fundingTokenSymbol) {
      return new TokenDisplayInfo(this.fundingTokenSymbol);
    }
    return undefined;
  }

  get selectedValueInBN() {
    let amount = this.selectedFaceValue?.spendAmount;
    if (!amount) {
      return toBN('0');
    }
    return toBN(toWei(`${amount * spendToUsdRate}`));
  }

  get balanceFromBN() {
    if (!this.fundingTokenBalance || this.fundingTokenBalance.isZero()) {
      return 0;
    }
    return Number(fromWei(this.fundingTokenBalance));
  }

  get isDisabled() {
    if (
      !this.selectedFaceValue?.spendAmount ||
      !this.fundingTokenBalance ||
      this.fundingTokenBalance.isZero()
    ) {
      return true;
    }
    return this.fundingTokenBalance.lt(this.selectedValueInBN);
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
      this.args.workflowSession.update('spendFaceValue', amount);
    }
    this.args.onComplete?.();
  }
}

export default FaceValueCard;
