import Koa from 'koa';
import { inject } from '../dependency-injection';
import { AuthenticationUtils } from '../utils/authentication';
import { recoverTypedSignature } from 'eth-sig-util';
import Logger from '@cardstack/logger';
import packageJson from '../package.json';

let log = Logger('route:session');

const MAX_NONCE_AGE_NS = BigInt(1000 * 1000 * 60 * 5); // 5 minutes
export default class SessionRoute {
  authenticationUtils: AuthenticationUtils = inject('authentication-utils', { as: 'authenticationUtils' });

  get(ctx: Koa.Context) {
    if (ctx.state.userAddress) {
      ctx.status = 200;
      ctx.body = {
        data: {
          attributes: {
            user: ctx.state.userAddress,
          },
        },
      };
    } else {
      ctx.status = 401;
      ctx.body = {
        data: {
          attributes: {
            nonce: this.authenticationUtils.generateNonce(),
            version: packageJson.version,
          },
        },
      };
    }
    ctx.type = 'application/vnd.api+json';
  }

  async post(ctx: Koa.Context) {
    let { authData, signature } = ctx.request.body.data.attributes;
    let userAddress = authData.message.user;
    let nonce = authData.message.nonce;
    let nonceTimestamp = this.authenticationUtils.extractVerifiedTimestamp(nonce);
    if (nonceTimestamp < process.hrtime.bigint() - MAX_NONCE_AGE_NS) {
      ctx.status = 401;
      ctx.body = {
        error: 'Expired nonce',
      };
      ctx.type = 'application/vnd.api+json';
      return;
    }

    try {
      let recoveredAddress = recoverTypedSignature({
        data: authData,
        sig: signature,
      });
      // Do a case-insensitive match because the case of the address returned by pubToAddress
      // does not always match the case of the address from the web3 provider.
      let isVerified = recoveredAddress.toUpperCase() === userAddress.toUpperCase();
      if (isVerified) {
        // generate auth token
        ctx.status = 200;
        ctx.body = {
          data: {
            attributes: {
              authToken: this.authenticationUtils.buildAuthToken(userAddress),
            },
          },
        };
        ctx.type = 'application/vnd.api+json';
        return;
      }
    } catch (e) {
      log.debug('Failure recovering address to verify ownership. Session will not be established.', e);
    }
    ctx.status = 401;
    ctx.body = {
      error: 'Signature not verified',
    };
    ctx.type = 'application/vnd.api+json';
  }
}

declare module '@cardstack/hub/dependency-injection' {
  interface KnownServices {
    'session-route': SessionRoute;
  }
}
