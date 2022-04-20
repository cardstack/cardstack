import HDWalletProvider from 'parity-hdwallet-provider';
import Web3 from 'web3';
import { AbstractProvider } from 'web3-core';
import { HttpProvider, networkIds, getConstantByNetwork, HubConfig } from '@cardstack/cardpay-sdk';
import WalletConnectProvider from '@walletconnect/web3-provider';
import { Options, Arguments } from 'yargs';
/* eslint-disable @typescript-eslint/no-require-imports,@typescript-eslint/no-var-requires */
const TrezorWalletProvider = require('trezor-cli-wallet-provider');

const BRIDGE = 'https://safe-walletconnect.gnosis.io/';

export type ConnectionType = 'mnemonic' | 'trezor' | 'wallet-connect';

interface Web3OptsMnemonic {
  connectionType: 'mnemonic';
  mnemonic: string;
}

interface Web3OptsTrezor {
  connectionType: 'trezor';
}

interface Web3OptsWalletConnect {
  connectionType: 'wallet-connect';
}

export type Web3Opts = Web3OptsMnemonic | Web3OptsTrezor | Web3OptsWalletConnect;

export function getWeb3Opts(args: Arguments): Web3Opts {
  switch (args.connectionType as ConnectionType) {
    case 'wallet-connect':
      return {
        connectionType: 'wallet-connect',
      } as Web3OptsWalletConnect;
    case 'trezor':
      return {
        connectionType: 'trezor',
      } as Web3OptsTrezor;
    case 'mnemonic':
      return {
        connectionType: 'mnemonic',
        mnemonic: args.mnemonic,
      } as Web3OptsMnemonic;
  }
}

export async function getWeb3(network: string, opts: Web3Opts): Promise<Web3> {
  let rpcNodeHttpsUrl!: string;
  let hubConfigResponse;
  let hubUrl = process.env.HUB_URL || getConstantByNetwork('hubUrl', network);
  let hubConfig = new HubConfig(hubUrl);
  hubConfigResponse = await hubConfig.getConfig();
  switch (network) {
    case 'kovan':
    case 'mainnet':
      rpcNodeHttpsUrl = hubConfigResponse.web3.layer1RpcNodeHttpsUrl as string;
      break;
    case 'sokol':
    case 'xdai':
      rpcNodeHttpsUrl = hubConfigResponse.web3.layer2RpcNodeHttpsUrl as string;
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
        rpc: {
          // we can't use OpenEthereum nodes as it was issues with modern web3
          // providers (specifically the xdai archive node that POA hosts falls
          // into this category)
          [networkIds[network]]: rpcNodeHttpsUrl,
        },
        bridge: BRIDGE,
      });
      await provider.enable();
      return new Web3(provider as unknown as AbstractProvider);
    }
    case 'mnemonic':
      return new Web3(
        new HDWalletProvider({
          chainId: networkIds[network],
          mnemonic: {
            phrase: opts.mnemonic,
          },
          providerOrUrl: new HttpProvider(rpcNodeHttpsUrl),
        })
      );
    case 'trezor':
      return new Web3(
        new TrezorWalletProvider(rpcNodeHttpsUrl, {
          chainId: networkIds[network],
        })
      );
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
  choices: ['sokol', 'xdai'],
} as Options;

export const NETWORK_OPTION_ANY = {
  alias: 'n',
  type: 'string',
  description: 'The network to run this script on',
  choices: ['sokol', 'kovan', 'xdai', 'mainnet'],
} as Options;

export const FROM_OPTION = {
  alias: 'f',
  type: 'string',
  description: 'The signing EOA. Defaults to the first derived EOA of the specified mnemonic',
} as Options;
