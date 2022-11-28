import { inject } from '@cardstack/di';
import { addDays, addMilliseconds } from 'date-fns';
import { nowUtc } from '../utils/dates';
import config from 'config';
import { ethers, Wallet } from 'ethers';
import { GasEstimationResultsScenarioEnum } from '@prisma/client';
import { convertChainIdToName } from '@cardstack/cardpay-sdk';
import { supportedChains } from '@cardstack/cardpay-sdk';
import { NotFound } from '@cardstack/core/src/utils/errors';

export interface GasEstimationParams {
  scenario: GasEstimationResultsScenarioEnum;
  chainId: number;
  tokenAddress?: string;
  gasTokenAddress?: string;
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
        tokenAddress: params.tokenAddress,
        gasTokenAddress: params.gasTokenAddress,
      },
    });

    if (gasLimit && addMilliseconds(gasLimit.updatedAt, this.gasLimitTTL) > nowUtc()) {
      return gasLimit;
    }

    let provider = this.ethersProvider.getInstance(params.chainId);
    let signer = new Wallet(config.get('hubPrivateKey'));
    let scheduledPaymentModule = await this.cardpay.getSDK('ScheduledPaymentModule', provider, signer);
    let gas;
    let tokenAmount = ethers.utils.parseUnits('1', 'gwei');
    let gasTokenAmount = ethers.utils.parseUnits('0.01', 'gwei');
    switch (params.scenario) {
      case GasEstimationResultsScenarioEnum.create_safe_with_module:
        gas = (
          await scheduledPaymentModule.createSafeWithModuleAndGuardEstimation({ from: signer.address })
        ).toNumber();
        break;
      case GasEstimationResultsScenarioEnum.execute_one_time_payment:
        if (
          !params.tokenAddress ||
          params.tokenAddress === '' ||
          !params.gasTokenAddress ||
          params.gasTokenAddress === ''
        ) {
          throw Error(`tokenAddress and gasTokenAddress is required in ${params.scenario}`);
        }
        gas = await scheduledPaymentModule.estimateExecutionGas(
          this.getHubSPModuleAddress(params.chainId),
          params.tokenAddress,
          tokenAmount.toString(),
          signer.address,
          gasTokenAmount.toString(),
          params.gasTokenAddress,
          'salt1',
          gasTokenAmount.toString(),
          Math.round(nowUtc().getTime() / 1000),
          null,
          null
        );
        break;
      case GasEstimationResultsScenarioEnum.execute_recurring_payment:
        if (
          !params.tokenAddress ||
          params.tokenAddress === '' ||
          !params.gasTokenAddress ||
          params.gasTokenAddress === ''
        ) {
          throw Error(`tokenAddress and gasTokenAddress is required in ${params.scenario}`);
        }
        gas = await scheduledPaymentModule.estimateExecutionGas(
          this.getHubSPModuleAddress(params.chainId),
          params.tokenAddress,
          tokenAmount.toString(),
          signer.address,
          gasTokenAmount.toString(),
          params.gasTokenAddress,
          'salt1',
          gasTokenAmount.toString(),
          null,
          28,
          Math.round(addDays(nowUtc(), 30).getTime() / 1000)
        );
        break;
    }

    gasLimit = await prisma.gasEstimationResult.upsert({
      where: {
        chainId_scenario_tokenAddress_gasTokenAddress: {
          chainId: params.chainId,
          scenario: params.scenario,
          tokenAddress: params.tokenAddress ?? '',
          gasTokenAddress: params.gasTokenAddress ?? '',
        },
      },
      create: {
        chainId: params.chainId,
        scenario: params.scenario,
        tokenAddress: params.tokenAddress,
        gasTokenAddress: params.gasTokenAddress,
        gas: gas,
      },
      update: {
        gas: gas,
      },
    });

    return gasLimit;
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