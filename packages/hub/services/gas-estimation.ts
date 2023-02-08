import { inject } from '@cardstack/di';
import { addDays, addMilliseconds } from 'date-fns';
import { nowUtc } from '../utils/dates';
import config from 'config';
import { Wallet } from 'ethers';
import { GasEstimationResultsScenarioEnum } from '@prisma/client';
import { getAddress } from '@cardstack/cardpay-sdk';

export interface GasEstimationParams {
  scenario: GasEstimationResultsScenarioEnum;
  chainId: number;
  safeAddress?: string;
}

export default class GasEstimationService {
  prismaManager = inject('prisma-manager', { as: 'prismaManager' });
  cardpay = inject('cardpay');
  ethersProvider = inject('ethers-provider', { as: 'ethersProvider' });
  readonly gasLimitTTL = 86400000; //1 days

  async estimate(params: GasEstimationParams) {
    let prisma = await this.prismaManager.getClient();
    let gasLimit = await prisma.gasEstimationResult.findFirst({
      where: {
        chainId: params.chainId,
        scenario: params.scenario,
      },
    });

    if (gasLimit && addMilliseconds(gasLimit.updatedAt, this.gasLimitTTL) > nowUtc()) {
      return gasLimit;
    }

    let provider = this.ethersProvider.getInstance(params.chainId);
    let signer = new Wallet(config.get('hubPrivateKey'));
    let scheduledPaymentModule = await this.cardpay.getSDK('ScheduledPaymentModule', provider, signer);

    let gas;
    switch (params.scenario) {
      case GasEstimationResultsScenarioEnum.create_safe_with_module:
        gas = (
          await scheduledPaymentModule.createSafeWithModuleAndGuardEstimation({ from: signer.address })
        ).toNumber();
        break;
      default:
        gas = await this.estimatePaymentExecution(params);
    }

    gasLimit = await prisma.gasEstimationResult.upsert({
      where: {
        chainId_scenario: {
          chainId: params.chainId,
          scenario: params.scenario,
        },
      },
      create: {
        chainId: params.chainId,
        scenario: params.scenario,
        gas: gas,
      },
      update: {
        gas: gas,
      },
    });

    return gasLimit;
  }

  private async estimatePaymentExecution(params: GasEstimationParams) {
    if (!params.safeAddress) {
      throw Error(`safeAddress is required in ${params.scenario}`);
    }

    let spModuleAddress = await this.getSpModuleAddress(params.chainId, params.safeAddress);
    let provider = this.ethersProvider.getInstance(params.chainId);
    let signer = new Wallet(config.get('hubPrivateKey'));
    let scheduledPaymentModule = await this.cardpay.getSDK('ScheduledPaymentModule', provider, signer);

    // Payment execution can support multiple transfer and gas tokens, but for estimating the
    // execution we can simply use the USDC token. This is because this token contract allows
    // zero amounts for transfer, which is usually not the case for other token implementations.
    // Because of this feature, we don't have to deposit any USDC to the safe if we
    // set the transaction amounts to 0. If we used some other transfer/gas token for estimation,
    // then we would have to deposit an adequate amount of tokens to the safe in order for
    // the estimation process to work.
    let gas;
    let usdTokenAddress = await getAddress('usdStableCoinToken', provider);
    switch (params.scenario) {
      case GasEstimationResultsScenarioEnum.execute_one_time_payment:
        gas = await scheduledPaymentModule.estimateExecutionGas(
          spModuleAddress,
          usdTokenAddress,
          '0',
          signer.address,
          '0',
          usdTokenAddress,
          'salt1',
          '0',
          Math.round(nowUtc().getTime() / 1000),
          null,
          null,
          0,
          0
        );
        break;
      case GasEstimationResultsScenarioEnum.execute_recurring_payment:
        gas = await scheduledPaymentModule.estimateExecutionGas(
          spModuleAddress,
          usdTokenAddress,
          '0',
          signer.address,
          '0',
          usdTokenAddress,
          'salt1',
          '0',
          null,
          28,
          Math.round(addDays(nowUtc(), 30).getTime() / 1000),
          0,
          0
        );
        break;
      default:
        throw Error('unknown estimation scenario');
    }

    // Add 25500 to handle transfer amount and gas token is not zero.
    // Add 30000 to make the payment gas is high enough to be executed.
    // Other tokens have different transfer logic
    // and will be executed through the USD conversion process.
    return gas + 25500 + 30000;
  }

  private async getSpModuleAddress(chainId: number, safeAddress: string): Promise<string> {
    let spModuleAddress = await this.cardpay.getSpModuleAddressBySafeAddress(chainId, safeAddress);
    if (!spModuleAddress) {
      throw Error(`cannot find SP module in this safe`);
    }
    return spModuleAddress;
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'gas-estimation-service': GasEstimationService;
  }
}
