import { inject } from '@cardstack/di';
import { addDays, addMilliseconds } from 'date-fns';
import { nowUtc } from '../utils/dates';
import config from 'config';
import { Wallet } from 'ethers';
import { GasEstimationResultsScenarioEnum } from '@prisma/client';
import { convertChainIdToName, getAddress, supportedChains } from '@cardstack/cardpay-sdk';
import { NotFound } from '@cardstack/core/src/utils/errors';

export interface GasEstimationParams {
  scenario: GasEstimationResultsScenarioEnum;
  chainId: number;
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
    let provider = this.ethersProvider.getInstance(params.chainId);
    let signer = new Wallet(config.get('hubPrivateKey'));
    let scheduledPaymentModule = await this.cardpay.getSDK('ScheduledPaymentModule', provider, signer);

    // Both transferAmount and gasPrice should be as small as possible
    // (so that we don't have to keep a non-trivial balance of tokens in the crank)
    // given their token decimal amount.
    // For transferAmount we should consider the underflow error,
    // since transferAmount will be calculated with fee percentage.
    // And gasPrice is price per unit of gas, so it will be multiplied by the gas execution.
    let transferAmount = '1000';
    let gasPrice = '1';
    let gas;
    let usdTokenAddress = await getAddress('usdStableCoinToken', provider);
    switch (params.scenario) {
      case GasEstimationResultsScenarioEnum.execute_one_time_payment:
        gas = await scheduledPaymentModule.estimateExecutionGas(
          this.getHubSPModuleAddress(params.chainId),
          usdTokenAddress,
          transferAmount.toString(),
          signer.address,
          gasPrice.toString(),
          usdTokenAddress,
          'salt1',
          gasPrice.toString(),
          Math.round(nowUtc().getTime() / 1000),
          null,
          null
        );
        break;
      case GasEstimationResultsScenarioEnum.execute_recurring_payment:
        gas = await scheduledPaymentModule.estimateExecutionGas(
          this.getHubSPModuleAddress(params.chainId),
          usdTokenAddress,
          transferAmount.toString(),
          signer.address,
          gasPrice.toString(),
          usdTokenAddress,
          'salt1',
          gasPrice.toString(),
          null,
          28,
          Math.round(addDays(nowUtc(), 30).getTime() / 1000)
        );
        break;
      default:
        throw Error('unknown estimation scenario');
    }

    return gas + 30000; // Add 30000 to make the payment gas is high enough to be executed
  }

  private getHubSPModuleAddress(chainId: number) {
    const networkName = convertChainIdToName(chainId);
    const hubSPModuleAddresses: { ethereum: string; gnosis: string; polygon: string } =
      config.get('hubSPModuleAddress');
    if (supportedChains.ethereum.includes(networkName)) return hubSPModuleAddresses.ethereum;
    if (supportedChains.gnosis.includes(networkName)) return hubSPModuleAddresses.gnosis;
    if (supportedChains.polygon.includes(networkName)) return hubSPModuleAddresses.polygon;

    throw new NotFound(`Cannot get Hub SP module address, unsupported network: ${chainId}`);
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'gas-estimation-service': GasEstimationService;
  }
}
