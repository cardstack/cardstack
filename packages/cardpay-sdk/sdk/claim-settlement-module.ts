/*global fetch */

import JsonRpcProvider from '../providers/json-rpc-provider';
import { Signer } from 'ethers';
import Module from './safe-module';

export default class ClaimSettlementModule extends Module {
  constructor(ethersProvider: JsonRpcProvider, signer?: Signer) {
    super(ethersProvider, signer);
  }
}
