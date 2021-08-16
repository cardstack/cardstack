import Koa from 'koa';
import autoBind from 'auto-bind';
import { inject } from '../di/dependency-injection';
import Wyre from '../services/wyre';
import { AuthenticationUtils } from '../utils/authentication';
import { ensureLoggedIn } from './utils/auth';
import Web3 from 'web3';

const { toChecksumAddress } = Web3.utils;
export default class CustodialWalletRoute {
  authenticationUtils: AuthenticationUtils = inject('authentication-utils', { as: 'authenticationUtils' });
  wyre: Wyre = inject('wyre');

  constructor() {
    autoBind(this);
  }

  async get(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }

    let userAddress = ctx.state.userAddress;
    let depositAddress: string, wyreWalletId: string;
    let existingWallet = await this.wyre.getCustodialWalletByUserAddress(userAddress);
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
      } = await this.wyre.createCustodialWallet(userAddress));
    }

    // From the outside we use checksum addresses since the relay server prefers
    // those, but when talking to wyre we use lowercase addresses
    let data = {
      id: toChecksumAddress(userAddress),
      type: 'custodial-wallets',
      attributes: {
        'wyre-wallet-id': wyreWalletId,
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

declare module '@cardstack/hub/di/dependency-injection' {
  interface KnownServices {
    'custodial-wallet-route': CustodialWalletRoute;
  }
}
