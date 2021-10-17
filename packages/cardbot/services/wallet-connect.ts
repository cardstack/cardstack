import Web3 from 'web3';
import WalletConnectProvider from '@walletconnect/web3-provider';
import { networkIds, getConstantByNetwork } from '@cardstack/cardpay-sdk';
import { AbstractProvider } from 'web3-core';
import QRCode from 'qrcode';
import config from 'config';
import { WalletConnectConfig, Web3Config } from '../types';
import logger from '@cardstack/logger';
import * as Sentry from '@sentry/node';
import tmp from 'tmp';
import { Message, MessageEmbed } from 'discord.js';
import { basename } from 'path';

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

    let replyPromise: Promise<Message> | undefined;
    let hasError = false;
    provider.connector.on('display_uri', (err, payload) => {
      if (err) {
        hasError = true;
        handleError('Error obtaining wallet connect URI', err);
        return;
      }
      const [uri] = payload.params;
      let qrCodeFile = `${tmp.tmpNameSync()}.png`;
      QRCode.toFile(qrCodeFile, uri, (err) => {
        if (err) {
          hasError = true;
          handleError('Error rendering QR code image', err);
          return;
        }
        let embed = new MessageEmbed()
          .setTitle('Scan This QR Code to Connect')
          .setDescription(
            `From your Card Wallet app, click on the "QR Code" button, scan this the code, and then tap on the "Connect" button to connect your Card Wallet so that I can give you a prepaid card.`
          )
          .attachFiles([qrCodeFile])
          .setImage(`attachment://${basename(qrCodeFile)}`);
        // capture this to make sure we don't leak async
        replyPromise = message.reply(embed);
      });
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
