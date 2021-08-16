import Koa from 'koa';
import autoBind from 'auto-bind';
import { inject } from '../di/dependency-injection';
import Wyre from '../services/wyre';
import { AuthenticationUtils } from '../utils/authentication';
import { ensureLoggedIn } from './utils/auth';

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

    let userAddress = ctx.state.userAddress.toLowerCase();
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

    let data = {
      id: userAddress,
      type: 'custodial-wallets',
      attributes: {
        'wyre-wallet-id': wyreWalletId,
        'deposit-address': depositAddress,
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
