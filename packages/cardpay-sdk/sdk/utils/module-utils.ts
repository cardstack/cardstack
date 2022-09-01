import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { getAddress } from '../../contracts/addresses';
import ModuleProxyFactoryABI from '../../contracts/abi/modules/module-proxy-factory';
import { Contract } from 'web3-eth-contract';
import { ethers, utils } from 'ethers';
import { Operation } from './safe-utils';
import multiSend from '../../contracts/abi/modules/multi-send';
import { pack } from '@ethersproject/solidity';
import { hexDataLength, Interface, LogDescription } from 'ethers/lib/utils';
import multiSendOnlyCall from '../../contracts/abi/modules/multi-send-call-only';
import { Transaction } from './general-utils';
import { Log } from 'web3-core';

export interface SetupArgs {
  types: string[];
  values: any[];
}

export async function deployAndSetUpModule(web3: Web3, masterCopy: Contract, setupArgs: SetupArgs) {
  let factory = new web3.eth.Contract(ModuleProxyFactoryABI as AbiItem[], await getAddress('moduleProxyFactory', web3));

  let encodeInitParams = web3.eth.abi.encodeParameters(setupArgs.types, setupArgs.values);
  let moduleSetupData = masterCopy.methods.setUp(encodeInitParams).encodeABI();
  let saltNonce = new Date().getTime().toString();
  let expectedModuleAddress = await calculateProxyAddress(
    factory,
    masterCopy.options.address,
    moduleSetupData,
    saltNonce
  );

  let deployData = factory.methods.deployModule(masterCopy.options.address, moduleSetupData, saltNonce).encodeABI();
  let transaction: Transaction = {
    data: deployData,
    to: factory.options.address,
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

  return ethers.utils.getCreate2Address(factory.options.address, salt, ethers.utils.keccak256(byteCode));
}

export async function encodeMultiSend(web3: Web3, transactions: readonly Transaction[]): Promise<Transaction> {
  const transactionsEncoded = '0x' + transactions.map(encodePacked).map(remove0x).join('');

  const multiSendContract = new web3.eth.Contract(multiSend as AbiItem[], await getAddress('multiSend', web3));
  const data = multiSendContract.methods.multiSend(transactionsEncoded).encodeABI();

  return {
    operation: Operation.DELEGATECALL,
    to: multiSendContract.options.address,
    value: '0',
    data,
  };
}

export async function encodeMultiSendCallOnly(web3: Web3, transactions: readonly Transaction[]): Promise<Transaction> {
  const transactionsEncoded = '0x' + transactions.map(encodePacked).map(remove0x).join('');

  const multiSendContract = new web3.eth.Contract(
    multiSendOnlyCall as AbiItem[],
    await getAddress('multiSendCallOnly', web3)
  );
  const data = multiSendContract.methods.multiSend(transactionsEncoded).encodeABI();

  return {
    operation: Operation.CALL,
    to: multiSendContract.options.address,
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

export async function getModuleProxyCreationEvent(web3: Web3, logs: Log[]): Promise<LogDescription[]> {
  let _interface = new utils.Interface(ModuleProxyFactoryABI);
  let moduleProxyFactoryAddress = await getAddress('moduleProxyFactory', web3);
  let events = logs
    .filter((log) => isModuleProxyCreationEvent(moduleProxyFactoryAddress, _interface, log))
    .map((log) => _interface.parseLog(log));
  return events;
}

function isModuleProxyCreationEvent(moduleProxyFactoryAddress: string, _interface: Interface, log: Log): boolean {
  return log.address === moduleProxyFactoryAddress && log.topics[0] === _interface.getEventTopic('ModuleProxyCreation');
}
