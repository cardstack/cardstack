/*global fetch */

import { getConstantByNetwork } from '@cardstack/cardpay-sdk';
import Web3 from 'web3';
import config from 'config';
import Logger from '@cardstack/logger';

let log = Logger('service:relay');

interface Web3Config {
  network: string;
}
interface RelayServiceConfig {
  provisionerSecret: string;
}

const { toChecksumAddress } = Web3.utils;
const { network } = config.get('web3') as Web3Config;
const { provisionerSecret } = config.get('relay') as RelayServiceConfig;

export default class RelayService {
  async isAvailable(): Promise<boolean> {
    let relayUrl = `${getConstantByNetwork('relayServiceURL', network)}/v1/about/`;
    try {
      let response = await fetch(relayUrl);
      if (!response.ok) {
        log.warn(`Relay service, ${relayUrl}, is not available: ${response.status}`);
      }
      return response.ok;
    } catch (e) {
      log.error(`Error encountered while checking if relay server ${relayUrl} is available`, e);
      return false;
    }
  }

  async provisionPrepaidCard(userAddress: string, sku: string): Promise<string> {
    let relayUrl = getConstantByNetwork('relayServiceURL', network);
    let response = await fetch(`${relayUrl}/v1/prepaid-card/provision/${sku}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: provisionerSecret,
      },
      body: JSON.stringify({
        owner: toChecksumAddress(userAddress),
      }),
    });
    let body = await response.json();
    if (!response.ok) {
      throw new Error(
        `Could not provision prepaid card for customer ${userAddress}, sku ${sku}, received ${
          response.status
        } from relay server: ${JSON.stringify(body)}`
      );
    }
    return body.txHash;
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    relay: RelayService;
  }
}
