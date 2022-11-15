/*global fetch */

import { supportedChains, convertChainIdToName } from '@cardstack/cardpay-sdk';
import { inject } from '@cardstack/di';
import { addMilliseconds } from 'date-fns';
import { nowUtc } from '../utils/dates';
import config from 'config';
import { ethers } from 'ethers';

export default class GasStationService {
  prismaManager = inject('prisma-manager', { as: 'prismaManager' });
  readonly gasPriceTTL = 60000; //1 minutes

  async getGasPriceByChainId(chainId: number) {
    let prisma = await this.prismaManager.getClient();
    let gasPrice = await prisma.gasPrice.findFirst({
      where: { chainId },
    });

    if (!gasPrice || addMilliseconds(gasPrice.updatedAt, this.gasPriceTTL) <= nowUtc()) {
      let url = this.getGasStatioUrl(chainId);
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
    }

    return gasPrice;
  }

  private getGasStatioUrl(chainId: number) {
    const networkName = convertChainIdToName(chainId);
    const gasStationUrls: { ethereum: string; gnosis: string; polygon: string } = config.get('gasStationUrls');
    if (supportedChains.ethereum.includes(networkName)) return gasStationUrls.ethereum;
    if (supportedChains.gnosis.includes(networkName)) return gasStationUrls.gnosis;
    if (supportedChains.polygon.includes(networkName)) return gasStationUrls.polygon;

    throw new Error(`Cannot get gas station url, unsupported network: ${chainId}`);
  }

  private extractGasPriceResponse(chainId: number, response: any) {
    const networkName = convertChainIdToName(chainId);
    if (supportedChains.ethereum.includes(networkName)) {
      return {
        slow: ethers.utils.parseUnits(String(response.result?.SafeGasPrice), 'gwei'),
        standard: ethers.utils.parseUnits(String(response.result?.ProposeGasPrice), 'gwei'),
        fast: ethers.utils.parseUnits(String(response.result?.FastGasPrice), 'gwei'),
      };
    }
    if (supportedChains.gnosis.includes(networkName)) {
      return {
        slow: ethers.utils.parseUnits(String(response.slow), 'gwei'),
        standard: ethers.utils.parseUnits(String(response.average), 'gwei'),
        fast: ethers.utils.parseUnits(String(response.fast), 'gwei'),
      };
    }
    if (supportedChains.polygon.includes(networkName)) {
      return {
        slow: ethers.utils.parseUnits(String(response.safeLow?.maxFee), 'gwei'),
        standard: ethers.utils.parseUnits(String(response.standard?.maxFee), 'gwei'),
        fast: ethers.utils.parseUnits(String(response.fast?.maxFee), 'gwei'),
      };
    }

    throw new Error(`Cannot extract gas price, unsupported network: ${chainId}`);
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'gas-station-service': GasStationService;
  }
}
