import BN from 'bn.js';
import Web3 from 'web3';
import { Estimate, SendPayload, Operation } from './safe-utils';
import PrepaidCardManagerABI from '../../contracts/abi/v0.9.0/prepaid-card-manager';
import GnosisSafeABI from '../../contracts/abi/gnosis-safe';
import { AbiItem, padLeft, toHex, numberToHex, hexToBytes } from 'web3-utils';

import { getAddress } from '../../contracts/addresses';
import { ZERO_ADDRESS } from '../constants';

import { networkName } from './general-utils';
import { networkIds } from '../constants';
import { gte } from 'semver';
import { Signer } from 'ethers';

export interface Signature {
  v: number;
  r: string;
  s: string | 0;
}

export async function signPrepaidCardSendTx(
  web3: Web3,
  prepaidCardAddress: string,
  payload: SendPayload,
  nonce: BN,
  from: string,
  signer?: Signer
): Promise<Signature[]> {
  let prepaidCardManager = new web3.eth.Contract(
    PrepaidCardManagerABI as AbiItem[],
    await getAddress('prepaidCardManager', web3)
  );
  let issuingToken = (await prepaidCardManager.methods.cardDetails(prepaidCardAddress).call()).issueToken;
  let signatures = await signSafeTxAsRSV(
    web3,
    issuingToken,
    0,
    payload.data,
    Operation.CALL,
    payload.safeTxGas,
    payload.dataGas,
    payload.gasPrice,
    payload.gasToken,
    payload.refundReceiver,
    nonce,
    from,
    prepaidCardAddress,
    signer
  );
  return signatures;
}
export async function signSafeTx(
  web3: Web3,
  safeAddress: string,
  to: string,
  data: string,
  estimate: Estimate,
  nonce: BN,
  from: string,
  signer?: Signer
): Promise<Signature[]> {
  let signatures = await signSafeTxAsRSV(
    web3,
    to,
    0,
    data,
    Operation.CALL,
    estimate.safeTxGas,
    estimate.dataGas,
    estimate.gasPrice,
    estimate.gasToken,
    ZERO_ADDRESS,
    nonce,
    from,
    safeAddress,
    signer
  );
  return signatures;
}

export async function signSafeTxAsRSV(
  web3: Web3,
  to: string,
  value: number,
  data: any,
  operation: Operation,
  txGasEstimate: string,
  baseGasEstimate: string,
  gasPrice: string,
  txGasToken: string,
  refundReceiver: string,
  nonce: any,
  owner: string,
  gnosisSafeAddress: string,
  signer?: Signer
): Promise<Signature[]> {
  const typedData = await safeTransactionTypedData(
    to,
    value,
    data,
    operation,
    txGasEstimate,
    baseGasEstimate,
    gasPrice,
    txGasToken,
    refundReceiver,
    nonce,
    gnosisSafeAddress,
    web3
  );
  const signatureRSV = [];
  const sig = await signTypedData(signer ?? web3, owner, typedData);
  signatureRSV.push(ethSignSignatureToRSVForSafe(sig));

  return signatureRSV;
}

export async function signSafeTxAsBytes(
  web3: Web3,
  to: string,
  value: number,
  data: any,
  operation: Operation,
  txGasEstimate: string,
  baseGasEstimate: string,
  gasPrice: string,
  txGasToken: string,
  refundReceiver: string,
  nonce: any,
  owner: string,
  gnosisSafeAddress: string,
  signer?: Signer
): Promise<string[]> {
  const typedData = await safeTransactionTypedData(
    to,
    value,
    data,
    operation,
    txGasEstimate,
    baseGasEstimate,
    gasPrice,
    txGasToken,
    refundReceiver,
    nonce,
    gnosisSafeAddress,
    web3
  );
  return [await signTypedData(signer ?? web3, owner, typedData)];
}

export async function signSafeTxWithEIP1271AsBytes(
  web3: Web3,
  to: string,
  value: number,
  data: any,
  operation: Operation,
  estimate: Estimate,
  refundReceiver: string,
  nonce: any,
  owner: string,
  gnosisSafeAddress: string,
  verifyingContractAddress: string,
  signer?: Signer
) {
  let eoaSignature = (
    await signSafeTxAsBytes(
      web3,
      to,
      value,
      data,
      operation,
      estimate.safeTxGas,
      estimate.baseGas,
      estimate.gasPrice,
      estimate.gasToken,
      refundReceiver,
      nonce,
      owner,
      gnosisSafeAddress,
      signer
    )
  )[0];
  let contractSignature = createEIP1271ContractSignature(verifyingContractAddress);

  let sortedSignatures = sortSignaturesAsBytes(eoaSignature, contractSignature, owner, verifyingContractAddress);
  let verifyingData = createEIP1271VerifyingData(
    web3,
    to,
    value.toString(),
    data,
    operation.toString(),
    estimate.safeTxGas,
    estimate.baseGas,
    estimate.gasPrice,
    estimate.gasToken,
    refundReceiver,
    nonce
  );
  return sortedSignatures[0] + sortedSignatures[1].replace('0x', '') + verifyingData;
}

async function safeTransactionTypedData(
  to: string,
  value: number,
  data: any,
  operation: Operation,
  txGasEstimate: string,
  baseGasEstimate: string,
  gasPrice: string,
  txGasToken: string,
  refundReceiver: string,
  nonce: any,
  gnosisSafeAddress: string,
  web3: Web3
) {
  let domain: { verifyingContract: string; chainId?: number } = {
    verifyingContract: gnosisSafeAddress,
  };
  let typedData = {
    types: {
      EIP712Domain: [{ type: 'address', name: 'verifyingContract' }],
      // "SafeTx(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 nonce)"
      SafeTx: [
        { type: 'address', name: 'to' },
        { type: 'uint256', name: 'value' },
        { type: 'bytes', name: 'data' },
        { type: 'uint8', name: 'operation' },
        { type: 'uint256', name: 'safeTxGas' },
        { type: 'uint256', name: 'baseGas' },
        { type: 'uint256', name: 'gasPrice' },
        { type: 'address', name: 'gasToken' },
        { type: 'address', name: 'refundReceiver' },
        { type: 'uint256', name: 'nonce' },
      ],
    },
    domain,
    primaryType: 'SafeTx',
    message: {
      to: to,
      value: value,
      data: data,
      operation: operation,
      safeTxGas: txGasEstimate,
      baseGas: baseGasEstimate,
      gasPrice: gasPrice,
      gasToken: txGasToken,
      refundReceiver: refundReceiver,
      nonce: nonce.toNumber(),
    },
  };

  let safe = new web3.eth.Contract(GnosisSafeABI as AbiItem[], gnosisSafeAddress);
  let safeVersion = await safe.methods.VERSION().call();

  if (gte(safeVersion, '1.3.0')) {
    let name = await networkName(web3);
    typedData.types.EIP712Domain.unshift({
      type: 'uint256',
      name: 'chainId',
    });
    typedData.domain.chainId = networkIds[name];
  }

  return typedData;
}

export async function signTypedData(web3OrSigner: Web3 | Signer, account: string, data: any): Promise<string> {
  let signature: string | undefined;
  let attempts = 0;
  do {
    if (attempts > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (Signer.isSigner(web3OrSigner)) {
      let signer = web3OrSigner;
      let {
        types: { SafeTx },
        domain,
        message,
      } = data;
      let types = { SafeTx };
      //@ts-ignore the _signTypedData method is unfortunately not typed
      signature = await signer._signTypedData(domain, types, message);
    } else {
      let web3 = web3OrSigner;
      signature = await new Promise((resolve, reject) => {
        let provider = web3.currentProvider;
        if (typeof provider === 'string') {
          throw new Error(`The provider ${web3.currentProvider} is not supported`);
        }
        if (provider == null) {
          throw new Error('No provider configured');
        }
        //@ts-ignore TS is complaining that provider might be undefined--but the
        //check above should prevent that from ever happening
        provider.send(
          {
            jsonrpc: '2.0',
            method: 'eth_signTypedData',
            params: [account, data],
            id: new Date().getTime(),
          },
          (err, response) => {
            if (err) {
              return reject(err);
            }
            resolve(response?.result);
          }
        );
      });
    }
  } while (signature == null && attempts++ < 50);
  if (!signature) {
    throw new Error(`unable to sign typed data for EOA ${account} with data ${JSON.stringify(data, null, 2)}`);
  }
  return signature;
}

export function ethSignSignatureToRSVForSafe(ethSignSignature: string) {
  const sig = ethSignSignature.replace('0x', '');
  const sigV = parseInt(sig.slice(-2), 16);
  const sigR = Web3.utils.toBN('0x' + sig.slice(0, 64)).toString();
  const sigS = Web3.utils.toBN('0x' + sig.slice(64, 128)).toString();

  return {
    v: sigV,
    r: sigR,
    s: sigS,
  };
}

export async function signRewardSafe(
  web3: Web3,
  to: string,
  value: number,
  data: any,
  operation: Operation,
  estimate: Estimate,
  txGasToken: string,
  refundReceiver: string,
  nonce: any,
  owner: string,
  gnosisSafeAddress: string,
  verifyingContractAddress: string,
  signer?: Signer
): Promise<any> {
  let [ownerSignature] = await signSafeTxAsRSV(
    web3,
    to,
    value,
    data,
    operation,
    estimate.safeTxGas,
    estimate.baseGas,
    estimate.gasPrice,
    txGasToken,
    refundReceiver,
    nonce,
    owner,
    gnosisSafeAddress,
    signer
  );

  let contractSignature = createEIP1271ContractSignatureRSV(verifyingContractAddress);
  let sortedRSVSignatures = sortSignatures(ownerSignature, contractSignature, owner, verifyingContractAddress);
  return sortedRSVSignatures;
}

function createEIP1271ContractSignature(verifyingContractAddress: string): string {
  const threshold = 2; //multi-owner in our protocol means two owners: eoa + contract
  const address = padLeft(verifyingContractAddress, 64).replace('0x', '');
  const dynamicPosition = padLeft(toHex(threshold * 65), 64).replace('0x', '');
  const signatureType = '00';
  return '0x' + address + dynamicPosition + signatureType;
}

function createEIP1271ContractSignatureRSV(verifyingContractAddress: string): Signature {
  return ethSignSignatureToRSVForSafe(createEIP1271ContractSignature(verifyingContractAddress));
}

export function createEIP1271VerifyingData(
  web3: Web3,
  to: string,
  value: string,
  data: string,
  operation: string,
  safeTxGas: string,
  baseGas: string,
  gasPrice: string,
  gasToken: string,
  refundReceiver: string,
  nonce: string
): string {
  const signData = web3.eth.abi.encodeParameters(
    ['address', 'uint256', 'bytes', 'uint8', 'uint256', 'uint256', 'uint256', 'address', 'address', 'uint256'],
    [to, value, data, operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, nonce]
  );
  const verifyingData = padLeft(signData.replace('0x', ''), 64);
  const verifyingDataLength = padLeft(numberToHex(hexToBytes(signData).length).replace('0x', ''), 64);
  return verifyingDataLength + verifyingData;
}

function sortSignatures(
  ownerSignature: Signature,
  contractSignature: Signature,
  safeOwnerAddress: string,
  contractAddress: string
) {
  if (safeOwnerAddress.toLowerCase() < contractAddress.toLowerCase()) {
    return [ownerSignature, contractSignature];
  } else {
    return [contractSignature, ownerSignature];
  }
}

function sortSignaturesAsBytes(
  ownerSignature: string,
  contractSignature: string,
  safeOwnerAddress: string,
  contractAddress: string
) {
  if (safeOwnerAddress.toLowerCase() < contractAddress.toLowerCase()) {
    return [ownerSignature, contractSignature];
  } else {
    return [contractSignature, ownerSignature];
  }
}
