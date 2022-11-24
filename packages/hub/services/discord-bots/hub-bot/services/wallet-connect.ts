import Web3 from 'web3';
import WalletConnectProvider from '@cardstack/wc-provider';
import { networkIds, getConstantByNetwork, CardPayCapableNetworks } from '@cardstack/cardpay-sdk';
import { AbstractProvider } from 'web3-core';
import config from 'config';
import logger from '@cardstack/logger';
import * as Sentry from '@sentry/node';
import { Message, buildMessageWithQRCode } from '@cardstack/discord-bot';
import { WalletConnectConfig } from '../types';

const log = logger('services:wallet-connect');

const { bridge, clientURL, clientName } = config.get('walletConnect') as WalletConnectConfig;
const network = config.get('web3.layer2Network') as CardPayCapableNetworks;
export default class WalletConnectService {
  async getWeb3(message: Message): Promise<Web3 | undefined> {
    let provider = new WalletConnectProvider({
      pollingInterval: 30000,
      clientMeta: {
        description: '',
        url: clientURL,
        icons: [],
        name: clientName,
      },
      chainId: networkIds[network],
      rpc: { [networkIds[network]]: config.get('web3.layer2RpcNodeHttpsUrl') as string },
      rpcWss: { [networkIds[network]]: config.get('web3.layer2RpcNodeWssUrl') as string },
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
        let merchantUniLinkDomain = getConstantByNetwork('merchantUniLinkDomain', network);
        let embed = (await buildMessageWithQRCode(uri))
          .setTitle('Scan This QR Code to Connect')
          .setDescription(
            `From your Cardstack Wallet app, tap on the "Scan QR" button, scan the QR code displayed here, ` +
              `and then tap on the "Connect" button to connect your Cardstack Wallet so that I can give you ` +
              `a prepaid card. On a mobile device? Install Cardstack Wallet and then tap this link: ` +
              `https://${merchantUniLinkDomain}/wc?uri=${uri}`
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
