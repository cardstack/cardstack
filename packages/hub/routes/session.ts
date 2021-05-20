import Koa from 'koa';
import { inject } from '../dependency-injection';
import { AuthenticationUtils } from '../utils/session';
import { recoverTypedSignature } from 'eth-sig-util';

export default class SessionRoute {
  authenticationUtils: AuthenticationUtils = inject('authentication-utils', { as: 'authenticationUtils' });

  get(ctx: Koa.Context) {
    ctx.status = 401;
    ctx.body = {
      data: {
        attributes: {
          nonce: this.authenticationUtils.generateNonce(),
          version: '0.0.1',
        },
      },
    };
    ctx.type = 'application/vnd.api+json';
  }

  async post(ctx: Koa.Context) {
    let { authData, signature } = ctx.request.body.data.attributes;
    let userAddress = authData.message.user;
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
      console.debug('Failure recovering address to verify ownership. Session will not be established.', e);
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
