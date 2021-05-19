import Koa from 'koa';
import { inject } from '../dependency-injection';
import { NonceGenerator } from '../utils/session';

export default class SessionRoute {
  nonceGenerator: NonceGenerator = inject('nonce-generator', { as: 'nonceGenerator' });

  get(ctx: Koa.Context) {
    ctx.set('Content-Type', 'application/json');
    ctx.status = 401;
    ctx.body = {
      nonce: this.nonceGenerator.generate(),
      version: '0.0.1',
    };
  }

  post(ctx: Koa.Context) {
    ctx.set('Content-Type', 'application/json');
    ctx.status = 200;
    ctx.body = {
      authToken: '',
    };
  }
}
