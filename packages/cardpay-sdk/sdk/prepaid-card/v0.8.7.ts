import Base from './base';

import BN from 'bn.js';
import { getAddress } from '../../contracts/addresses';
import { ZERO_ADDRESS } from '../constants';
import ERC677ABI from '../../contracts/abi/erc-677';
import { AbiItem } from 'web3-utils';

export default class PrepaidCard extends Base {
  // This override is needed because PrepaidCardManager in protocol v0.8.8
  // expects only 5 params in the data field of transferAndCall.
  // In protocol v0.9.0, it expects 2 params more (issuer and issuerSafe).
  protected async getCreateCardPayload(
    owner: string,
    tokenAddress: string,
    issuingTokenAmounts: BN[],
    spendAmounts: number[],
    customizationDID = '',
    marketAddress = ZERO_ADDRESS
  ): Promise<string> {
    let prepaidCardManagerAddress = await getAddress('prepaidCardManager', this.layer2Web3);
    let token = new this.layer2Web3.eth.Contract(ERC677ABI as AbiItem[], tokenAddress);
    let sum = new BN(0);
    for (let amount of issuingTokenAmounts) {
      sum = sum.add(amount);
    }

    return token.methods
      .transferAndCall(
        prepaidCardManagerAddress,
        sum,
        this.layer2Web3.eth.abi.encodeParameters(
          ['address', 'uint256[]', 'uint256[]', 'string', 'address'],
          [owner, issuingTokenAmounts, spendAmounts.map((i) => i.toString()), customizationDID, marketAddress]
        )
      )
      .encodeABI();
  }
}
