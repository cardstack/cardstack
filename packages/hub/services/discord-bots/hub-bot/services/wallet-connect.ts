import Web3 from 'web3';
import WalletConnectProvider from '@walletconnect/web3-provider';
import { networkIds, getConstantByNetwork } from '@cardstack/cardpay-sdk';
import { AbstractProvider } from 'web3-core';
import config from 'config';
import logger from '@cardstack/logger';
import * as Sentry from '@sentry/node';
import { Message, buildMessageWithQRCode } from '@cardstack/discord-bot';
import { WalletConnectConfig, Web3Config } from '../types';

const log = logger('services:wallet-connect');

const { bridge, clientURL, clientName } = config.get('walletConnect') as WalletConnectConfig;
const { network } = config.get('web3') as Web3Config;
export default class WalletConnectService {
  async getWeb3(message: Message): Promise<Web3 | undefined> {
    let provider = new WalletConnectProvider({
      clientMeta: {
        description: '',
        url: clientURL,
        icons: [],
        name: clientName,
      },
      qrcode: false,
      rpc: {
        [networkIds[network]]: getConstantByNetwork('rpcNode', network),
      },
      bridge,
    });

    let replyPromise: Promise<unknown> | undefined;
    let hasError = false;
    provider.connector.on('display_uri', async (err, payload) => {
      if (err) {
        hasError = true;
        handleError('Error obtaining wallet connect URI', err);
        return;
      }
      const [uri] = payload.params;
      try {
        let embed = (await buildMessageWithQRCode(uri))
          .setTitle('Scan This QR Code to Connect')
          .setDescription(
            `From your Card Wallet app, click on the "QR Code" button, scan this the code, and then tap on the "Connect" button to connect your Card Wallet so that I can give you a prepaid card.`
          );
        // capture this to make sure we don't leak async
        replyPromise = message.reply(embed);
      } catch (e: any) {
        hasError = true;
        handleError('Error building or sending QR Code MessageEmbed', e);
      }
    });

    if (hasError) {
      return;
    }

    await provider.enable();
    await replyPromise;

    let web3 = new Web3(provider as unknown as AbstractProvider);
    return web3;
  }
}

function handleError(msg: string, err: Error) {
  log.error(msg, err);
  Sentry.withScope(function () {
    Sentry.captureException(err);
  });
}

declare module '@cardstack/di' {
  interface KnownServices {
    'wallet-connect': WalletConnectService;
  }
}
