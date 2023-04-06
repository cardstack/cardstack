import Web3 from 'web3';
import { signTypedData } from './utils/signing-utils';
import { isJsonRpcProvider, networkName } from './utils/general-utils';
import { getConstantByNetwork, networkIds } from './constants';
import { ContractOptions } from 'web3-eth-contract';
import { Signer } from 'ethers';
import JsonRpcProvider from '../providers/json-rpc-provider';

/**
 * @group Hub
 */
export interface IHubAuth {
  getNonce(): Promise<NonceResponse>;
  authenticate(): Promise<string>;
  checkValidAuth(authToken: string): Promise<boolean>;
  getHubUrl(network?: string): Promise<string>;
}
/**
 * @group Hub
 */
export interface NonceResponse {
  nonce: string;
  version: string;
}

/**
 * @group Hub
 */
export default class HubAuth implements IHubAuth {
  constructor(
    private web3OrEthersProvider: Web3 | JsonRpcProvider,
    private hubRootUrl?: string,
    private layer2Signer?: Signer
  ) {}

  async checkValidAuth(authToken: string): Promise<boolean> {
    let response = await this.httpGetSession(authToken);
    return response.status === 200;
  }

  async getNonce(): Promise<NonceResponse> {
    let response = await this.httpGetSession();
    if (response.status !== 401) {
      console.error('Failure fetching nonce', await response.text());
      throw new Error('Failure fetching nonce');
    }
    let responseJson = await response.json();
    return responseJson.errors[0].meta;
  }

  async authenticate(contractOptions?: ContractOptions): Promise<string> {
    let ownerAddress;
    if (contractOptions && contractOptions.from) {
      ownerAddress = contractOptions.from;
    } else if (this.layer2Signer) {
      ownerAddress = await this.layer2Signer.getAddress();
    } else if (isJsonRpcProvider(this.web3OrEthersProvider)) {
      ownerAddress = await this.web3OrEthersProvider.getSigner().getAddress();
    } else {
      ownerAddress = (await this.web3OrEthersProvider.eth.getAccounts())[0];
    }
    let { nonce, version } = await this.getNonce();

    const netName = await networkName(this.web3OrEthersProvider);
    const chainId = networkIds[netName];

    const hubUrl = await this.getHubUrl(netName);

    const typedData = {
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
        ],
        HubAuthentication: [
          { name: 'user', type: 'address' },
          { name: 'nonce', type: 'string' },
        ],
      },
      domain: {
        name: hubUrl.replace(/https?:\/\//, ''),
        version,
        chainId,
      },
      primaryType: 'HubAuthentication',
      message: {
        user: ownerAddress,
        nonce,
      },
    };
    let signature = await signTypedData(this.layer2Signer ?? this.web3OrEthersProvider, ownerAddress, typedData);
    let postBody = JSON.stringify({
      data: {
        attributes: {
          authData: typedData,
          signature,
        },
      },
    });
    let response = await global.fetch(`${hubUrl}/api/session`, {
      method: 'POST',
      headers: {
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

  private async httpGetSession(authToken?: string): Promise<Response> {
    const hubUrl = await this.getHubUrl();

    let url = `${hubUrl}/api/session`;
    let headers = {
      'Content-Type': 'application/vnd.api+json',
    } as Record<string, string>;
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    return global.fetch(url, { headers });
  }

  async getHubUrl(network?: string): Promise<string> {
    const netName = network || (await networkName(this.web3OrEthersProvider));

    return this.hubRootUrl || getConstantByNetwork('hubUrl', netName) || '';
  }
}
