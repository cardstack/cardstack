import { SelectableToken } from '@cardstack/boxel/components/boxel/input/selectable-token';
import { ConfiguredScheduledPaymentFees } from '@cardstack/safe-tools-client/services/scheduled-payment-sdk';
import { BigNumber, utils as ethersUtils } from 'ethers';

export interface CurrentFees {
  fixedFeeInUSD: number | undefined;
  fixedFeeInGasTokenUnits: BigNumber | undefined;
  percentageFee: number | undefined;
  variableFeeInPaymentTokenUnits: BigNumber | undefined;
}

export default class FeeCalculator {
  constructor(
    private configuredFees: ConfiguredScheduledPaymentFees,
    private paymentAmountInTokenUnits: BigNumber,
    private paymentToken: SelectableToken,
    private gasToken: SelectableToken
  ) {}

  calculateFee(): CurrentFees {
    const { configuredFees } = this;
    return {
      fixedFeeInUSD: configuredFees.fixedUSD,
      percentageFee: configuredFees.percentage,
      fixedFeeInGasTokenUnits: this.calculateFixedFee(),
      variableFeeInPaymentTokenUnits: this.calculateVariableFee(),
    };
  }

  private calculateFixedFee() {
    return BigNumber.from('250000'); //TODO convert configuredFees.fixedUSD to gas token units
  }

  private calculateVariableFee() {
    const { configuredFees, paymentToken, paymentAmountInTokenUnits } = this;
    const variableFeeRate = (configuredFees.percentage || 0) / 100;
    const variableFeeInPaymentTokenFloat =
      paymentAmountInTokenUnits.toNumber() * variableFeeRate;
    const variableFeeInPaymentTokenBigNumber = ethersUtils.parseUnits(
      variableFeeInPaymentTokenFloat.toString(),
      paymentToken.decimals
    );
    return configuredFees.percentage
      ? variableFeeInPaymentTokenBigNumber
      : BigNumber.from('0');
  }
}
