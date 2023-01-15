import { SelectableToken } from '@cardstack/boxel/components/boxel/input/selectable-token';
import { countDecimalPlaces } from '@cardstack/cardpay-sdk';
import { ConfiguredScheduledPaymentFees } from '@cardstack/safe-tools-client/services/scheduled-payment-sdk';
import TokenQuantity from '@cardstack/safe-tools-client/utils/token-quantity';
import { BigNumber } from 'ethers';

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
    private gasToken: SelectableToken,
    private usdToGasTokenRate: BigNumber
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
    const fixedFeeUSDNum = this.configuredFees.fixedUSD;
    let amount: BigNumber;
    if (fixedFeeUSDNum) {
      const dp = countDecimalPlaces(fixedFeeUSDNum);
      const numerator = fixedFeeUSDNum * 10 ** dp;
      const denominator = 10 ** dp;
      amount = BigNumber.from(this.usdToGasTokenRate)
        .mul(numerator)
        .div(denominator);
    } else {
      amount = BigNumber.from(0);
    }
    return new TokenQuantity(this.gasToken, amount);
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
