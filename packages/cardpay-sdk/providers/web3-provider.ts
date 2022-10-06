'use strict';

/* eslint-disable node/no-extraneous-import */
import { Networkish } from '@ethersproject/networks';

/* eslint-disable node/no-extraneous-import */
import { Logger } from '@ethersproject/logger';
import { version } from 'ethers';
import { JSONRPCRequestPayload, JSONRPCResponsePayload } from 'ethereum-protocol';
import JsonRpcProvider from './json-rpc-provider';
const logger = new Logger(version);

// Exported Types
export interface ExternalProvider {
  isMetaMask?: boolean;
  isStatus?: boolean;
  host?: string;
  path?: string;
  sendAsync?: (
    request: JSONRPCRequestPayload,
    callback: (error: any, response: JSONRPCResponsePayload) => void
  ) => void;
  send?: (request: JSONRPCRequestPayload, callback: (error: any, response: JSONRPCResponsePayload) => void) => void;
  request?: (request: JSONRPCRequestPayload) => Promise<any>;
}

let _nextId = 1;

export type JsonRpcFetchFunc = (method: string, params: any[]) => Promise<any>;

type Web3LegacySend = (request: any, callback: (error: Error, response: any) => void) => void;

function buildWeb3LegacyFetcher(sendFunc: Web3LegacySend): JsonRpcFetchFunc {
  return function (method: string, params: any[]): Promise<any> {
    const request = {
      method: method,
      params: params,
      id: _nextId++,
      jsonrpc: '2.0',
    };

    return new Promise((resolve, reject) => {
      sendFunc(request, (error, response) => {
        if (error) {
          return reject(error);
        }
        if (response.error) {
          const error = new Error(response.error.message);
          (error as any).code = response.error.code;
          (error as any).data = response.error.data;
          return reject(error);
        }
        resolve(response.result);
      });
    });
  };
}

function buildEip1193Fetcher(provider: ExternalProvider): JsonRpcFetchFunc {
  return function (method: string, params: any[]): Promise<any> {
    if (!provider.request) {
      throw new Error('request function is not exist');
    }
    if (params == null) {
      params = [];
    }

    const request = { method, params, id: _nextId++, jsonrpc: '2.0' };

    return provider.request(request).then(
      (response) => {
        return response;
      },
      (error) => {
        throw error;
      }
    );
  };
}

// This is the patched @ethersproject/providers/Web3Provider
// that make ExternalProvider class compatible
// with existing cardpay WalletConnectProvider
// and extend from JSONRpcProvider
// to get the same behavior on handling error messages
export default class Web3Provider extends JsonRpcProvider {
  readonly provider: ExternalProvider;
  readonly jsonRpcFetchFunc: JsonRpcFetchFunc;

  constructor(provider: ExternalProvider | JsonRpcFetchFunc, network?: Networkish) {
    logger.checkNew(new.target, Web3Provider);

    if (provider == null) {
      logger.throwArgumentError('missing provider', 'provider', provider);
    }

    let path: string;
    let jsonRpcFetchFunc: JsonRpcFetchFunc | null = null;
    let subprovider: ExternalProvider | null = null;

    if (typeof provider === 'function') {
      path = 'unknown:';
      jsonRpcFetchFunc = provider;
    } else {
      path = provider.host || provider.path || '';
      if (!path && provider.isMetaMask) {
        path = 'metamask';
      }

      subprovider = provider;

      if (provider.request) {
        if (path === '') {
          path = 'eip-1193:';
        }
        jsonRpcFetchFunc = buildEip1193Fetcher(provider);
      } else if (provider.sendAsync) {
        jsonRpcFetchFunc = buildWeb3LegacyFetcher(provider.sendAsync.bind(provider));
      } else if (provider.send) {
        jsonRpcFetchFunc = buildWeb3LegacyFetcher(provider.send.bind(provider));
      } else {
        logger.throwArgumentError('unsupported provider', 'provider', provider);
      }

      if (!path) {
        path = 'unknown:';
      }
    }

    super(path, network);

    this.jsonRpcFetchFunc = jsonRpcFetchFunc as JsonRpcFetchFunc;
    this.provider = subprovider as ExternalProvider;
  }

  send(method: string, params: any[]): Promise<any> {
    return this.jsonRpcFetchFunc(method, params);
  }
}
