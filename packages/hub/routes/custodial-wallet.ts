import Koa from 'koa';
import autoBind from 'auto-bind';
import { inject } from '@cardstack/di';
import { ensureLoggedIn } from './utils/auth';
import Web3 from 'web3';

const { toChecksumAddress } = Web3.utils;
export default class CustodialWalletRoute {
  authenticationUtils = inject('authentication-utils', { as: 'authenticationUtils' });
  wyre = inject('wyre');

  constructor() {
    autoBind(this);
  }

  async get(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }

    let userAddress = ctx.state.userAddress;
    let depositAddress: string, wyreWalletId: string;
    let existingWallet = await this.wyre.getWalletByUserAddress(userAddress);
    if (existingWallet) {
      ({
        depositAddresses: { ETH: depositAddress },
        id: wyreWalletId,
      } = existingWallet);
    } else {
      // otherwise we create a new custodial wallet for this user address in wyre
      ({
        depositAddresses: { ETH: depositAddress },
        id: wyreWalletId,
      } = await this.wyre.createWallet(userAddress));
    }

    // From the outside we use checksum addresses since the relay server prefers
    // those, but when talking to wyre we use lowercase addresses
    let checksumUserAddress = toChecksumAddress(userAddress);
    let data = {
      id: checksumUserAddress,
      type: 'custodial-wallets',
      attributes: {
        'wyre-wallet-id': wyreWalletId,
        'user-address': checksumUserAddress,
        'deposit-address': toChecksumAddress(depositAddress),
      },
    };
    ctx.status = 200;
    ctx.body = {
      data,
    };
    ctx.type = 'application/vnd.api+json';
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'route:custodial-wallet': CustodialWalletRoute;
  }
}
