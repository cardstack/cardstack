import Web3 from 'web3';
import { CONTRACT_EVENTS } from '../../services/contract-subscription-event-handler';
import ContractsService from '../../services/contracts';
import { AbstractProvider } from 'web3-core';
import { protocolVersions } from '@cardstack/cardpay-sdk';

describe('ContractsService', function () {
  let resultId = 1;
  for (const contractUsageInfo of CONTRACT_EVENTS) {
    for (const protocolVersion of protocolVersions) {
      it(`getContract retrieves a web3 Contract instance for ${contractUsageInfo.abiName} contract version ${protocolVersion}`, async function () {
        let subject = new ContractsService();
        let web3 = new Web3();
        let mockProvider = {
          sendAsync(_, callback) {
            callback(null, {
              jsonrpc: '2.0',
              id: resultId++,
              result: web3.eth.abi.encodeParameter('string', protocolVersion.replace('v', '')),
            } as any);
          },
        } as AbstractProvider;
        web3.setProvider(mockProvider);
        web3.eth.net.getId = (_callback) => {
          return Promise.resolve(100);
        };
        let contract;
        try {
          contract = await subject.getContract(web3, contractUsageInfo.abiName, contractUsageInfo.contractName);
        } catch (e) {
          expect.fail(
            `Failed to getContract for ${contractUsageInfo.abiName} contract.
            
  This may be due to a missing ABI definition. Check to see whether SDK codegen is working properly.
            
  ${e}`
          );
        }
        expect(contract).to.be.an.instanceOf(web3.eth.Contract);
        expect(contract).to.exist;
      });
    }
  }
});
