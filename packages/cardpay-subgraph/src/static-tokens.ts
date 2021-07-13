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
    let staticTokens = new Array<StaticToken>(1);

    // Add SAI
    let tokenSAI = new StaticToken(
      Address.fromString('0xc439E5B1DEe4f866B681E7c5E5dF140aA47fBf19'),
      'SAI',
      'SAI on xDai',
      BigInt.fromI32(18)
    );
    staticTokens.push(tokenSAI);
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
