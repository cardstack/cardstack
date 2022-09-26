import { getAddress } from '../../contracts/addresses';
import ModuleProxyFactoryABI from '../../contracts/abi/modules/module-proxy-factory';
import { Contract, ethers, utils } from 'ethers';
import { Operation } from './safe-utils';
import multiSend from '../../contracts/abi/modules/multi-send';
import { pack } from '@ethersproject/solidity';
import { hexDataLength, Interface, LogDescription } from 'ethers/lib/utils';
import multiSendOnlyCall from '../../contracts/abi/modules/multi-send-call-only';
import { generateSaltNonce, Transaction } from './general-utils';
import { Log } from 'web3-core';
import JsonRpcProvider from '../../providers/json-rpc-provider';

export interface SetupArgs {
  types: string[];
  values: any[];
}

export async function deployAndSetUpModule(
  ethersProvider: JsonRpcProvider,
  masterCopy: Contract,
  setupArgs: SetupArgs
) {
  let factory = new Contract(
    await getAddress('moduleProxyFactory', ethersProvider),
    ModuleProxyFactoryABI,
    ethersProvider
  );

  let encodeInitParams = utils.defaultAbiCoder.encode(setupArgs.types, setupArgs.values);
  let moduleSetupData = masterCopy.interface.encodeFunctionData('setUp', [encodeInitParams]);
  let saltNonce = generateSaltNonce('cardstack-sp-deploy-module');
  let expectedModuleAddress = await calculateProxyAddress(factory, masterCopy.address, moduleSetupData, saltNonce);

  let deployData = factory.interface.encodeFunctionData('deployModule', [
    masterCopy.address,
    moduleSetupData,
    saltNonce,
  ]);
  let transaction: Transaction = {
    data: deployData,
    to: factory.address,
    value: '0',
    operation: Operation.CALL,
  };
  return {
    transaction,
    expectedModuleAddress,
  };
}

export async function calculateProxyAddress(
  factory: Contract,
  masterCopyAddress: string,
  initData: string,
  saltNonce: string
) {
  masterCopyAddress = masterCopyAddress.toLowerCase().replace(/^0x/, '');
  const byteCode = '0x602d8060093d393df3363d3d373d3d3d363d73' + masterCopyAddress + '5af43d82803e903d91602b57fd5bf3';

  const salt = ethers.utils.solidityKeccak256(
    ['bytes32', 'uint256'],
    [ethers.utils.solidityKeccak256(['bytes'], [initData]), saltNonce]
  );

  return ethers.utils.getCreate2Address(factory.address, salt, ethers.utils.keccak256(byteCode));
}

export async function encodeMultiSend(
  ethersProvider: JsonRpcProvider,
  transactions: readonly Transaction[]
): Promise<Transaction> {
  const transactionsEncoded = '0x' + transactions.map(encodePacked).map(remove0x).join('');

  const multiSendContract = new Contract(await getAddress('multiSend', ethersProvider), multiSend, ethersProvider);
  const data = multiSendContract.interface.encodeFunctionData('multiSend', [transactionsEncoded]);

  return {
    operation: Operation.DELEGATECALL,
    to: multiSendContract.address,
    value: '0',
    data,
  };
}

export async function encodeMultiSendCallOnly(
  ethersProvider: JsonRpcProvider,
  transactions: readonly Transaction[]
): Promise<Transaction> {
  const transactionsEncoded = '0x' + transactions.map(encodePacked).map(remove0x).join('');

  const multiSendContract = new Contract(
    await getAddress('multiSendCallOnly', ethersProvider),
    multiSendOnlyCall,
    ethersProvider
  );
  const data = multiSendContract.interface.encodeFunctionData('multiSend', [transactionsEncoded]);

  return {
    operation: Operation.CALL,
    to: multiSendContract.address,
    value: '0',
    data,
  };
}

function encodePacked(tx: Transaction) {
  return pack(
    ['uint8', 'address', 'uint256', 'uint256', 'bytes'],
    [tx.operation || Operation.CALL, tx.to, tx.value, hexDataLength(tx.data), tx.data]
  );
}

function remove0x(hexString: string) {
  return hexString.replace(/^0x/, '');
}

export async function getModuleProxyCreationEvent(
  ethersProvider: JsonRpcProvider,
  logs: Log[]
): Promise<LogDescription[]> {
  let _interface = new utils.Interface(ModuleProxyFactoryABI);
  let moduleProxyFactoryAddress = await getAddress('moduleProxyFactory', ethersProvider);
  let events = logs
    .filter((log) => isModuleProxyCreationEvent(moduleProxyFactoryAddress, _interface, log))
    .map((log) => _interface.parseLog(log));
  return events;
}

function isModuleProxyCreationEvent(moduleProxyFactoryAddress: string, _interface: Interface, log: Log): boolean {
  return log.address === moduleProxyFactoryAddress && log.topics[0] === _interface.getEventTopic('ModuleProxyCreation');
}
