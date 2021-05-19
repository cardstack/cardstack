import Web3 from 'web3';
import { networkName, signTypedData } from './utils';
import { networkIds } from './constants';

interface NonceResponse {
  nonce: string;
  version: string;
}

export default class HubAuth {
  constructor(private layer2Web3: Web3, private hubHost: string) {}

  async getNonce(): Promise<NonceResponse> {
    let url = `http://${this.hubHost}/session`;
    let response = await global.fetch(url);
    let responseJson = await response.json();
    return responseJson;
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
        Authentication: [
          { name: 'user', type: 'address' },
          { name: 'nonce', type: 'string' },
        ],
      },
      domain: {
        name: this.hubHost,
        version,
        chainId,
      },
      primaryType: 'Authentication',
      message: {
        user: ownerAddress,
        nonce: nonce,
      },
    };
    let signature = await signTypedData(this.layer2Web3, ownerAddress, typedData);
    let postBody = JSON.stringify({
      authData: typedData,
      signature,
    });
    console.log(postBody);
    let response = await global.fetch(`http://${this.hubHost}/session`, {
      method: 'POST',
      headers: {
        //eslint-disable-next-line @typescript-eslint/naming-convention
        'Content-Type': 'application/json',
      },
      body: postBody,
    });
    if (response.ok) {
      let responseJson = await response.json();
      return responseJson.authToken;
    } else {
      // TODO: throw error?
      return '';
    }
  }
}
