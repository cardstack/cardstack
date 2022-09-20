import HDWalletProvider from '@truffle/hdwallet-provider';
import Web3 from 'web3';
import { Wallet, Signer } from 'ethers';
import { AbstractProvider } from 'web3-core';
import { HttpProvider, networkIds, getConstantByNetwork, HubConfig } from '@cardstack/cardpay-sdk';
import WalletConnectProvider from '@cardstack/wc-provider';
import { Options, Arguments } from 'yargs';
/* eslint-disable @typescript-eslint/no-require-imports,@typescript-eslint/no-var-requires */
const TrezorWalletProvider = require('trezor-cli-wallet-provider');

const BRIDGE = 'https://safe-walletconnect.gnosis.io/';

export type ConnectionType = 'mnemonic' | 'ethers-mnemonic' | 'trezor' | 'wallet-connect';

export interface Web3OptsMnemonic {
  connectionType: 'mnemonic';
  mnemonic: string;
}

interface EthersOptsMnemonic {
  connectionType: 'ethers-mnemonic';
  mnemonic: string;
}

interface Web3OptsTrezor {
  connectionType: 'trezor';
}

interface Web3OptsWalletConnect {
  connectionType: 'wallet-connect';
}

export type Web3Opts = Web3OptsMnemonic | Web3OptsTrezor | Web3OptsWalletConnect | EthersOptsMnemonic;

export function getConnectionType(args: Arguments): Web3Opts {
  switch (args.connectionType as ConnectionType) {
    case 'wallet-connect':
      return {
        connectionType: 'wallet-connect',
      } as Web3OptsWalletConnect;
    case 'trezor':
      return {
        connectionType: 'trezor',
      } as Web3OptsTrezor;
    case 'ethers-mnemonic':
      return {
        connectionType: 'ethers-mnemonic',
        mnemonic: args.ethersMnemonic,
      } as EthersOptsMnemonic;
    case 'mnemonic':
      return {
        connectionType: 'mnemonic',
        mnemonic: args.mnemonic,
      } as Web3OptsMnemonic;
  }
}

export async function getEthereumClients(network: string, opts: Web3Opts): Promise<{ web3: Web3; signer?: Signer }> {
  let rpcNodeHttpsUrl!: string;
  let rpcNodeWssUrl!: string;
  let hubConfigResponse;
  let hubUrl = process.env.HUB_URL || getConstantByNetwork('hubUrl', network);
  let hubConfig = new HubConfig(hubUrl);
  hubConfigResponse = await hubConfig.getConfig();
  switch (network) {
    case 'kovan':
      rpcNodeHttpsUrl = hubConfigResponse.web3.layer1RpcNodeHttpsUrl as string;
      rpcNodeWssUrl = hubConfigResponse.web3.layer1RpcNodeWssUrl as string;
      break;
    case 'goerli':
    case 'mainnet':
      rpcNodeHttpsUrl = hubConfigResponse.web3.ethereum.rpcNodeHttpsUrl as string;
      rpcNodeWssUrl = hubConfigResponse.web3.ethereum.rpcNodeWssUrl as string;
      break;
    case 'sokol':
    case 'gnosis':
    case 'xdai':
      rpcNodeHttpsUrl = hubConfigResponse.web3.gnosis.rpcNodeHttpsUrl as string;
      rpcNodeWssUrl = hubConfigResponse.web3.gnosis.rpcNodeWssUrl as string;
      break;
    case 'mumbai':
    case 'polygon':
      rpcNodeHttpsUrl = hubConfigResponse.web3.polygon.rpcNodeHttpsUrl as string;
      rpcNodeWssUrl = hubConfigResponse.web3.polygon.rpcNodeWssUrl as string;
      break;
  }
  switch (opts.connectionType) {
    case 'wallet-connect': {
      let provider = new WalletConnectProvider({
        clientMeta: {
          description: '',
          url: 'https://app.cardstack.com',
          icons: [],
          name: 'Cardstack - Cardpay CLI',
        },
        chainId: networkIds[network],
        rpc: { [networkIds[network]]: rpcNodeHttpsUrl },
        rpcWss: { [networkIds[network]]: rpcNodeWssUrl },
        bridge: BRIDGE,
      });
      await provider.enable();
      return { web3: new Web3(provider as unknown as AbstractProvider) };
    }
    case 'mnemonic':
      return {
        web3: new Web3(
          new HDWalletProvider({
            chainId: networkIds[network],
            mnemonic: {
              phrase: opts.mnemonic,
            },
            providerOrUrl: new HttpProvider(rpcNodeHttpsUrl),
          })
        ),
      };
    case 'ethers-mnemonic':
      return {
        web3: new Web3(
          new HDWalletProvider({
            chainId: networkIds[network],
            mnemonic: {
              phrase: opts.mnemonic,
            },
            providerOrUrl: new HttpProvider(rpcNodeHttpsUrl),
          })
        ),
        signer: Wallet.fromMnemonic(opts.mnemonic),
      };
    case 'trezor':
      return {
        web3: new Web3(
          new TrezorWalletProvider(rpcNodeHttpsUrl, {
            chainId: networkIds[network],
          })
        ),
      };
  }
}

export const NETWORK_OPTION_LAYER_1 = {
  alias: 'n',
  type: 'string',
  description: 'The Layer 1 network to run this script on',
  choices: ['kovan', 'mainnet'],
} as Options;

export const NETWORK_OPTION_LAYER_2 = {
  alias: 'n',
  type: 'string',
  description: 'The Layer 2 network to run this script on',
  choices: ['sokol', 'gnosis', 'xdai'],
} as Options;

export const NETWORK_OPTION_ANY = {
  alias: 'n',
  type: 'string',
  description: 'The network to run this script on',
  choices: ['sokol', 'kovan', 'goerli', 'mumbai', 'gnosis', 'xdai', 'mainnet'],
} as Options;

export const FROM_OPTION = {
  alias: 'f',
  type: 'string',
  description: 'The signing EOA. Defaults to the first derived EOA of the specified mnemonic',
} as Options;
