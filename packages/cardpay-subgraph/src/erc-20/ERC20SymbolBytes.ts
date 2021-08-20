// Taken from generated ERC-20 ABI. We are replicating this here to avoid having
// token specific data source generated modules, since ERC-20's are all the same
// regardless of token

import { ethereum, Bytes, Address } from '@graphprotocol/graph-ts';

export class ERC20SymbolBytes extends ethereum.SmartContract {
  static bind(address: Address): ERC20SymbolBytes {
    return new ERC20SymbolBytes('ERC20SymbolBytes', address);
  }

  symbol(): Bytes {
    let result = super.call('symbol', 'symbol():(bytes32)', []);

    return result[0].toBytes();
  }

  try_symbol(): ethereum.CallResult<Bytes> {
    let result = super.tryCall('symbol', 'symbol():(bytes32)', []);
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    let value = result.value;
    return ethereum.CallResult.fromValue(value[0].toBytes());
  }
}
