import { countDecimalPlaces, TokenDetail } from '@cardstack/cardpay-sdk';
import { ConfiguredScheduledPaymentFees } from '@cardstack/safe-tools-client/services/scheduled-payment-sdk';
import TokenQuantity from '@cardstack/safe-tools-client/utils/token-quantity';
import { BigNumber, FixedNumber } from 'ethers';

const USDC_DECIMALS = 6;

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
    private gasToken: TokenDetail,
    private usdcToGasTokenRate: FixedNumber | undefined
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
    const { usdcToGasTokenRate } = this;
    let amount: BigNumber;
    if (fixedFeeUSDNum && usdcToGasTokenRate) {
      const fixedFeeUSDCFixedNum = FixedNumber.from(
        fixedFeeUSDNum.toString()
      ).mulUnsafe(FixedNumber.from(10 ** USDC_DECIMALS));
      amount = BigNumber.from(
        usdcToGasTokenRate
          .mulUnsafe(fixedFeeUSDCFixedNum)
          .round(0)
          .toString()
          .split('.')[0]
      );
    } else {
      amount = BigNumber.from(0);
    }
    return new TokenQuantity(this.gasToken, amount);
  }

  private calculateVariableFee() {
    const { configuredFees, paymentTokenQuantity } = this;
    const variableFeeRate = (configuredFees.percentage || 0) / 100;
    const variableFeeRateDecimals = countDecimalPlaces(variableFeeRate);
    const numerator = variableFeeRate * 10 ** variableFeeRateDecimals;
    const denominator = 10 ** variableFeeRateDecimals;
    const variableFeeInPaymentTokenBigNumber = paymentTokenQuantity.count
      .mul(numerator)
      .div(denominator);
    return new TokenQuantity(
      paymentTokenQuantity.token,
      configuredFees.percentage
        ? variableFeeInPaymentTokenBigNumber
        : BigNumber.from('0')
    );
  }
}
