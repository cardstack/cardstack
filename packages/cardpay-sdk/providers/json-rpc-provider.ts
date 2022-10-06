import { BigNumber, logger, providers } from 'ethers';
import { ConnectionInfo, fetchJson, isHexString, Logger, shallowCopy } from 'ethers/lib/utils';
/* eslint-disable node/no-extraneous-import */
import { Networkish } from '@ethersproject/networks';

const errorGas = ['call', 'estimateGas'];

function spelunk(value: any): null | { message: string; data: string } {
  if (value == null) {
    return null;
  }

  // These *are* the droids we're looking for.
  if (typeof value.message === 'string' && value.message.match('reverted') && isHexString(value.data)) {
    return { message: value.message, data: value.data };
  }

  // Spelunk further...
  if (typeof value === 'object') {
    for (const key in value) {
      const result = spelunk(value[key]);
      if (result) {
        return result;
      }
    }
    return null;
  }

  // Might be a JSON string we can further descend...
  if (typeof value === 'string') {
    return spelunk(JSON.parse(value));
  }

  return null;
}

function getResult(payload: { error?: { code?: number; data?: any; message?: string }; result?: any }): any {
  if (payload.error) {
    // @TODO: not any
    const error: any = new Error(payload.error.message);
    error.code = payload.error.code;
    error.data = payload.error.data;
    throw error;
  }

  return payload.result;
}

function checkError(method: string, error: any): any {
  // Undo the "convenience" some nodes are attempting to prevent backwards
  // incompatibility; maybe for v6 consider forwarding reverts as errors
  if (method === 'call') {
    const result = spelunk(error);
    if (result) {
      return result.data;
    }

    logger.throwError(
      'missing revert data in call exception; Transaction reverted without a reason string',
      Logger.errors.CALL_EXCEPTION,
      error
    );
  }

  // @TODO: Should we spelunk for message too?
  let message = error.message;
  if (error.code === Logger.errors.SERVER_ERROR && error.error && typeof error.error.message === 'string') {
    message = error.error.message;
  } else if (typeof error.body === 'string') {
    message = error.body;
  } else if (typeof error.responseText === 'string') {
    message = error.responseText;
  }
  message = (message || '').toLowerCase();

  // "insufficient funds for gas * price + value + cost(data)"
  if (message.match(/insufficient funds|base fee exceeds gas limit/)) {
    logger.throwError('insufficient funds for intrinsic transaction cost', Logger.errors.INSUFFICIENT_FUNDS, error);
  }

  // "nonce too low"
  if (message.match(/nonce (is )?too low/)) {
    logger.throwError('nonce has already been used', Logger.errors.NONCE_EXPIRED, error);
  }

  // "replacement transaction underpriced"
  if (message.match(/replacement transaction underpriced/)) {
    logger.throwError('replacement fee too low', Logger.errors.REPLACEMENT_UNDERPRICED, error);
  }

  // "replacement transaction underpriced"
  if (message.match(/only replay-protected/)) {
    logger.throwError('legacy pre-eip-155 transactions not supported', Logger.errors.UNSUPPORTED_OPERATION, error);
  }

  if (
    errorGas.indexOf(method) >= 0 &&
    message.match(/gas required exceeds allowance|always failing transaction|execution reverted/)
  ) {
    logger.throwError(
      'cannot estimate gas; transaction may fail or may require manual gas limit',
      Logger.errors.UNPREDICTABLE_GAS_LIMIT,
      error
    );
  }

  throw error;
}

// This is the patched @ethersproject/providers/JsonRpcProvider
// that will throw an error message in the format that
// make SDK easier to extract revert messages from smart contracts
export default class JsonRpcProvider extends providers.JsonRpcProvider {
  constructor(url?: ConnectionInfo | string, network?: Networkish) {
    super(url, network);
  }

  async perform(method: string, params: any): Promise<any> {
    // Legacy networks do not like the type field being passed along (which
    // is fair), so we delete type if it is 0 and a non-EIP-1559 network
    if (method === 'call' || method === 'estimateGas') {
      const tx = params.transaction;
      if (tx && tx.type != null && BigNumber.from(tx.type).isZero()) {
        // If there are no EIP-1559 properties, it might be non-EIP-a559
        if (tx.maxFeePerGas == null && tx.maxPriorityFeePerGas == null) {
          const feeData = await this.getFeeData();
          if (feeData.maxFeePerGas == null && feeData.maxPriorityFeePerGas == null) {
            // Network doesn't know about EIP-1559 (and hence type)
            params = shallowCopy(params);
            params.transaction = shallowCopy(tx);
            delete params.transaction.type;
          }
        }
      }
    }

    const args = this.prepareRequest(method, params);

    if (args == null) {
      logger.throwError(method + ' not implemented', Logger.errors.NOT_IMPLEMENTED, { operation: method });
    }
    try {
      return await this.send(args[0], args[1]);
    } catch (error) {
      return checkError(method, error);
    }
  }

  send(method: string, params: any[]): Promise<any> {
    const request = {
      method: method,
      params: params,
      id: this._nextId++,
      jsonrpc: '2.0',
    };

    const result = fetchJson(this.connection, JSON.stringify(request), getResult).then(
      (result) => {
        return result;
      },
      (error) => {
        let revertError = error;
        if (error.error) {
          revertError = error.error;
        }
        throw revertError;
      }
    );

    return result;
  }
}
