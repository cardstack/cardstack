import Koa from 'koa';
import { handleError } from './error';

export function ensureLoggedIn(ctx: Koa.Context): boolean {
  if (ctx.state.userAddress) {
    return true;
  }
  handleError(ctx, 401, 'No valid auth token');
  return false;
}
