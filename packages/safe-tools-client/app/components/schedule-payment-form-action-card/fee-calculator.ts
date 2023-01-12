import { SelectableToken } from '@cardstack/boxel/components/boxel/input/selectable-token';
import { ConfiguredScheduledPaymentFees } from '@cardstack/safe-tools-client/services/scheduled-payment-sdk';
import TokenQuantity from '@cardstack/safe-tools-client/utils/token-quantity';
import { BigNumber, utils as ethersUtils } from 'ethers';

export interface CurrentFees {
  fixedFeeInUSD: number | undefined;
  fixedFee: TokenQuantity | undefined;
  percentageFee: number | undefined;
  variableFee: TokenQuantity | undefined;
}

export default class FeeCalculator {
  constructor(
    private configuredFees: ConfiguredScheduledPaymentFees,
    private paymentTokenQuantity: TokenQuantity,
    private gasToken: SelectableToken
  ) {}

  calculateFee(): CurrentFees {
    const { configuredFees } = this;
    return {
      fixedFeeInUSD: configuredFees.fixedUSD,
      percentageFee: configuredFees.percentage,
      fixedFee: this.calculateFixedFee(),
      variableFee: this.calculateVariableFee(),
    };
  }

  private calculateFixedFee() {
    return new TokenQuantity(this.gasToken, BigNumber.from('250000')); //TODO convert configuredFees.fixedUSD to gas token units
  }

  private calculateVariableFee() {
    const { configuredFees, paymentTokenQuantity } = this;
    console.log(
      `calculateVariableFee(${configuredFees}, ${paymentTokenQuantity})`
    );
    const variableFeeRate = (configuredFees.percentage || 0) / 100;
    console.log(`variableFeeRate = ${variableFeeRate}`);
    const variableFeeInPaymentTokenFloat = Math.round(
      paymentTokenQuantity.count.toNumber() * variableFeeRate
    );
    console.log(
      `variableFeeInPaymentTokenFloat = ${variableFeeInPaymentTokenFloat}`
    );
    const variableFeeInPaymentTokenBigNumber = BigNumber.from(
      variableFeeInPaymentTokenFloat
    );
    console.log(
      `variableFeeInPaymentTokenBigNumber = ${variableFeeInPaymentTokenBigNumber}`
    );
    return new TokenQuantity(
      paymentTokenQuantity.token,
      configuredFees.percentage
        ? variableFeeInPaymentTokenBigNumber
        : BigNumber.from('0')
    );
  }
}
