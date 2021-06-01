import Web3 from 'web3';

export interface Signature {
  v: number;
  r: string;
  s: string | 0;
}

export async function sign(
  web3: Web3,
  to: string,
  value: number,
  data: any,
  operation: number,
  txGasEstimate: string,
  baseGasEstimate: string,
  gasPrice: string,
  txGasToken: string,
  refundReceiver: string,
  nonce: any,
  owner: string,
  gnosisSafeAddress: string
): Promise<Signature[]> {
  const typedData = {
    types: {
      //eslint-disable-next-line @typescript-eslint/naming-convention
      EIP712Domain: [{ type: 'address', name: 'verifyingContract' }],
      // "SafeTx(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 nonce)"
      //eslint-disable-next-line @typescript-eslint/naming-convention
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
    domain: {
      verifyingContract: gnosisSafeAddress,
    },
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
  const signatureBytes = [];
  const sig = await signTypedData(web3, owner, typedData);
  signatureBytes.push(ethSignSignatureToRSVForSafe(sig));

  return signatureBytes;
}

export function signTypedData(web3: Web3, account: string, data: any): Promise<string> {
  return new Promise((resolve, reject) => {
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
