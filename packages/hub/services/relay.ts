/*global fetch */

import { getConstantByNetwork } from '@cardstack/cardpay-sdk';
import Web3 from 'web3';
import config from 'config';

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
  async provisionPrepaidCard(userAddress: string, sku: string): Promise<string> {
    let relayUrl = getConstantByNetwork('relayServiceURL', network);
    let response = await fetch(`${relayUrl}/v1/prepaid-card/provision/${sku}/`, {
      method: 'POST',
      headers: {
        contentType: 'application/json',
        authorization: provisionerSecret,
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

declare module '@cardstack/hub/di/dependency-injection' {
  interface KnownServices {
    relay: RelayService;
  }
}
