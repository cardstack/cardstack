/*global fetch */

import { supportedChains, convertChainIdToName } from '@cardstack/cardpay-sdk';
import { inject } from '@cardstack/di';
import { addMilliseconds } from 'date-fns';
import { nowUtc } from '../utils/dates';
import config from 'config';
import { ethers } from 'ethers';
import { NotFound } from '@cardstack/core/src/utils/errors';

export default class GasStationService {
  prismaManager = inject('prisma-manager', { as: 'prismaManager' });
  readonly gasPriceTTL = 60000; //1 minutes

  async getGasPriceByChainId(chainId: number) {
    let prisma = await this.prismaManager.getClient();
    let gasPrice = await prisma.gasPrice.findFirst({
      where: { chainId },
    });

    if (gasPrice && addMilliseconds(gasPrice.updatedAt, this.gasPriceTTL) > nowUtc()) {
      return gasPrice;
    }

    let url = this.getGasStationUrl(chainId);
    let response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(`Cannot retrieve gas price from gas station: ${url}`);
    }

    let gasPriceResponse = this.extractGasPriceResponse(chainId, await response.json());
    gasPrice = await prisma.gasPrice.upsert({
      where: { chainId },
      create: {
        chainId,
        slow: gasPriceResponse.slow.toString(),
        standard: gasPriceResponse.standard.toString(),
        fast: gasPriceResponse.fast.toString(),
      },
      update: {
        slow: gasPriceResponse.slow.toString(),
        standard: gasPriceResponse.standard.toString(),
        fast: gasPriceResponse.fast.toString(),
      },
    });

    return gasPrice;
  }

  private getGasStationUrl(chainId: number) {
    const networkName = convertChainIdToName(chainId);
    const gasStationUrls: { ethereum: string; gnosis: string; polygon: string } = config.get('gasStationUrls');
    if (supportedChains.ethereum.includes(networkName)) return gasStationUrls.ethereum;
    if (supportedChains.gnosis.includes(networkName)) return gasStationUrls.gnosis;
    if (supportedChains.polygon.includes(networkName)) return gasStationUrls.polygon;

    throw new NotFound(`Cannot get gas station url, unsupported network: ${chainId}`);
  }

  private extractGasPriceResponse(chainId: number, response: any) {
    let gasPrice;
    const networkName = convertChainIdToName(chainId);
    if (supportedChains.ethereum.includes(networkName)) {
      gasPrice = {
        slow: Number(response.result?.SafeGasPrice),
        standard: Number(response.result?.ProposeGasPrice),
        fast: Number(response.result?.FastGasPrice),
      };
    } else if (supportedChains.gnosis.includes(networkName)) {
      gasPrice = {
        slow: Number(response.slow),
        standard: Number(response.average),
        fast: Number(response.fast),
      };
    } else if (supportedChains.polygon.includes(networkName)) {
      gasPrice = {
        slow: Number(response.safeLow?.maxFee),
        standard: Number(response.standard?.maxFee),
        fast: Number(response.fast?.maxFee),
      };
    } else {
      throw new NotFound(`Cannot extract gas price, unsupported network: ${chainId}`);
    }

    // Convert from gwei to wei
    // ensure decimal point of gwei is 9 to avoid underflow error
    return {
      slow: ethers.utils.parseUnits(String(gasPrice.slow.toFixed(9)), 'gwei'),
      standard: ethers.utils.parseUnits(String(gasPrice.standard.toFixed(9)), 'gwei'),
      fast: ethers.utils.parseUnits(String(gasPrice.fast.toFixed(9)), 'gwei'),
    };
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'gas-station-service': GasStationService;
  }
}
