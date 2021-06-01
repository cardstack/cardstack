import Web3 from 'web3';
import { signTypedData } from './utils/signing-utils';
import { networkName } from './utils/general-utils';
import { networkIds } from './constants';

interface NonceResponse {
  nonce: string;
  version: string;
}

export default class HubAuth {
  constructor(private layer2Web3: Web3, private hubRootUrl: string) {}

  async getNonce(): Promise<NonceResponse> {
    let url = `${this.hubRootUrl}/api/session`;
    let response = await global.fetch(url, {
      headers: {
        //eslint-disable-next-line @typescript-eslint/naming-convention
        'Content-Type': 'application/vnd.api+json',
      },
    });
    if (response.status !== 401) {
      console.error('Failure fetching nonce', await response.text());
      throw new Error('Failure fetching nonce');
    }
    let responseJson = await response.json();
    return responseJson.errors[0].meta;
  }

  async authenticate(): Promise<string> {
    let ownerAddress = (await this.layer2Web3.eth.getAccounts())[0];
    let { nonce, version } = await this.getNonce();
    let name = await networkName(this.layer2Web3);
    let chainId = networkIds[name];
    const typedData = {
      types: {
        //eslint-disable-next-line @typescript-eslint/naming-convention
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
        ],
        //eslint-disable-next-line @typescript-eslint/naming-convention
        HubAuthentication: [
          { name: 'user', type: 'address' },
          { name: 'nonce', type: 'string' },
        ],
      },
      domain: {
        name: this.hubRootUrl.replace(/https?:\/\//, ''),
        version,
        chainId,
      },
      primaryType: 'HubAuthentication',
      message: {
        user: ownerAddress,
        nonce,
      },
    };
    let signature = await signTypedData(this.layer2Web3, ownerAddress, typedData);
    let postBody = JSON.stringify({
      data: {
        attributes: {
          authData: typedData,
          signature,
        },
      },
    });
    let response = await global.fetch(`${this.hubRootUrl}/api/session`, {
      method: 'POST',
      headers: {
        //eslint-disable-next-line @typescript-eslint/naming-convention
        'Content-Type': 'application/vnd.api+json',
      },
      body: postBody,
    });
    if (response.ok) {
      let responseJson = await response.json();
      return responseJson.data.attributes.authToken;
    } else {
      let responseJson = await response.json();
      console.error('Failed.', responseJson);
      // TODO: throw error?
      return '';
    }
  }
}
