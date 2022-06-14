/*global fetch */

import { getConstantByNetwork } from '@cardstack/cardpay-sdk';
import Web3 from 'web3';
import config from 'config';
import Logger from '@cardstack/logger';

let log = Logger('service:relay');

interface Web3Config {
  layer2Network: string;
}
interface RelayServiceConfig {
  provisionerSecret: string;
}

const { toChecksumAddress } = Web3.utils;
const web3config = config.get('web3') as Web3Config;
const { provisionerSecret } = config.get('relay') as RelayServiceConfig;

export default class RelayService {
  async isAvailable(): Promise<boolean> {
    let relayUrl = `${getConstantByNetwork('relayServiceURL', web3config.layer2Network)}/v1/about/`;
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
    let relayUrl = getConstantByNetwork('relayServiceURL', web3config.layer2Network);
    if (!provisionerSecret) {
      throw new Error(`Could not provision prepaid card because relay.provisionerSecret config is not set.`);
    }
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
    if (!response.ok) {
      let body = await response.text();
      throw new Error(
        `Could not provision prepaid card for customer ${userAddress}, sku ${sku}, received ${response.status} from relay server: ${body}`
      );
    }
    let body = await response.json();
    return body.txHash;
  }

  async provisionPrepaidCardV2(userAddress: string, sku: string): Promise<string> {
    let relayUrl = getConstantByNetwork('relayServiceURL', web3config.layer2Network);
    if (!provisionerSecret) {
      throw new Error(`Could not provision prepaid card because relay.provisionerSecret config is not set.`);
    }
    let response = await fetch(`${relayUrl}/v2/prepaid-card/provision/${sku}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: provisionerSecret,
      },
      body: JSON.stringify({
        owner: toChecksumAddress(userAddress),
      }),
    });
    if (!response.ok) {
      let body = await response.text();
      throw new Error(
        `Could not provision prepaid card v2 for customer ${userAddress}, sku ${sku}, received ${response.status} from relay server: ${body}`
      );
    }
    let body = await response.json();
    return body.txHash;
  }

  async registerProfile(userAddress: string, did: string): Promise<string> {
    let relayUrl = getConstantByNetwork('relayServiceURL', web3config.layer2Network);
    if (!provisionerSecret) {
      throw new Error(`Could not register profile because relay.provisionerSecret config is not set.`);
    }
    let response = await fetch(`${relayUrl}/v2/profiles/register?eoa=${userAddress}&did=${did}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: provisionerSecret,
      },
      body: JSON.stringify({
        owner: toChecksumAddress(userAddress),
      }),
    });

    if (!response.ok) {
      let body = await response.text();
      throw new Error(
        `Could not register profile card v2 for customer ${userAddress}, did ${did}, received ${response.status} from relay server: ${body}`
      );
    }

    let body = await response.json();
    return body.txHash;
  }
}

declare module '@cardstack/hub/services' {
  interface HubServices {
    relay: RelayService;
  }
}
