import Koa from 'koa';
import autoBind from 'auto-bind';
import DatabaseManager from '../services/database-manager';
import { inject } from '../di/dependency-injection';
import Wyre from '../services/wyre';
import { AuthenticationUtils } from '../utils/authentication';

export default class CustodialWalletRoute {
  authenticationUtils: AuthenticationUtils = inject('authentication-utils', { as: 'authenticationUtils' });
  databaseManager: DatabaseManager = inject('database-manager', { as: 'databaseManager' });
  wyre: Wyre = inject('wyre');

  constructor() {
    autoBind(this);
  }

  async get(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }

    let userAddress = ctx.state.userAddress.toLowerCase();
    let db = await this.databaseManager.getClient();
    let result = await db.query(
      'SELECT user_address, wyre_wallet_id, deposit_address FROM custodial_wallets WHERE user_address = $1',
      [userAddress]
    );
    let depositAddress: string, wyreWalletId: string;
    if (result.rows.length === 0) {
      ({
        depositAddresses: { ETH: depositAddress },
        id: wyreWalletId,
      } = await this.wyre.createCustodialWallet(userAddress));
      await db.query(
        'INSERT INTO custodial_wallets (user_address, wyre_wallet_id, deposit_address) VALUES ($1, $2, $3)',
        [userAddress, wyreWalletId, depositAddress]
      );
    } else {
      let {
        rows: [row],
      } = result;
      ({ wyre_wallet_id: wyreWalletId, deposit_address: depositAddress } = row);
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

function ensureLoggedIn(ctx: Koa.Context) {
  if (ctx.state.userAddress) {
    return true;
  }
  ctx.body = {
    errors: [
      {
        status: '401',
        title: 'No valid auth token',
      },
    ],
  };
  ctx.status = 401;
  ctx.type = 'application/vnd.api+json';
  return false;
}

declare module '@cardstack/hub/di/dependency-injection' {
  interface KnownServices {
    'custodial-wallet-route': CustodialWalletRoute;
  }
}
