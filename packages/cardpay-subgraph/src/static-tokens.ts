import { Address, BigInt } from '@graphprotocol/graph-ts';

// Initialize a Token Definition with the attributes
export class StaticToken {
  address: Address;
  symbol: string;
  name: string;
  decimals: BigInt;

  // Initialize a Token Definition with its attributes
  constructor(address: Address, symbol: string, name: string, decimals: BigInt) {
    this.address = address;
    this.symbol = symbol;
    this.name = name;
    this.decimals = decimals;
  }

  // Get all tokens with a static definition
  static getStaticTokens(): Array<StaticToken> {
    let staticTokens = new Array<StaticToken>(0);
    // add any static tokens detail here that are unable to be obtained via
    // token contract

    // let token = new StaticToken(
    //   Address.fromString('0x12345'),
    //   'TOKEN',
    //   'Token Name',
    //   BigInt.fromI32(18)
    // );
    // staticTokens.push(token);

    return staticTokens;
  }

  // Helper for hardcoded tokens
  static fromAddress(tokenAddress: Address): StaticToken | null {
    let staticDefinitions = this.getStaticTokens();
    let tokenAddressHex = tokenAddress.toHexString();

    // Search the definition using the address
    for (let i = 0; i < staticDefinitions.length; i++) {
      let staticDefinition = staticDefinitions[i];
      if (staticDefinition.address.toHexString() == tokenAddressHex) {
        return staticDefinition;
      }
    }

    // If not found, return null
    return null;
  }
}
