import Koa from 'koa';
import { inject } from '@cardstack/di';
import { AuthenticationUtils } from '../utils/authentication';
import NonceTracker, { MAX_NONCE_AGE_NS } from '../services/nonce-tracker';
import { recoverTypedSignature } from 'eth-sig-util';
import Logger from '@cardstack/logger';
import packageJson from '../package.json';
import autoBind from 'auto-bind';

let log = Logger('route:session');

export default class SessionRoute {
  authenticationUtils: AuthenticationUtils = inject('authentication-utils', { as: 'authenticationUtils' });
  nonceTracker: NonceTracker = inject('nonce-tracker', { as: 'nonceTracker' });
  constructor() {
    autoBind(this);
  }

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
        errors: [
          {
            meta: {
              nonce: this.authenticationUtils.generateNonce(),
              version: packageJson.version,
            },
            status: '401',
            title: 'No valid auth token',
          },
        ],
      };
    }
    ctx.type = 'application/vnd.api+json';
  }

  async post(ctx: Koa.Context) {
    function setUnauthorizedResponse(detail: string): void {
      ctx.status = 401;
      ctx.body = {
        errors: [
          {
            status: '401',
            title: 'Invalid signature',
            detail,
          },
        ],
      };
      ctx.type = 'application/vnd.api+json';
    }
    let { authData, signature } = ctx.request.body.data.attributes;
    let userAddress = authData.message.user;
    let nonce = authData.message.nonce;
    let nonceTimestamp = this.authenticationUtils.extractVerifiedTimestamp(nonce);
    if (nonceTimestamp < process.hrtime.bigint() - MAX_NONCE_AGE_NS) {
      setUnauthorizedResponse('Expired nonce');
      return;
    }
    if (await this.nonceTracker.wasRecentlyUsed(nonce)) {
      setUnauthorizedResponse('Nonce already used');
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
        await this.nonceTracker.markRecentlyUsed(nonce);
        return;
      }
    } catch (e) {
      log.debug('Failure recovering address to verify ownership. Session will not be established.', e);
    }
    setUnauthorizedResponse('Signature not verified for specified address');
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'session-route': SessionRoute;
  }
}
