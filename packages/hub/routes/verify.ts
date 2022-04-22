import Koa from 'koa';
import autoBind from 'auto-bind';
import { query } from '../queries';
import { inject } from '@cardstack/di';

export default class EmailCardDropVerifyRoute {
  emailCardDropRequestQueries = query('email-card-drop-requests', { as: 'emailCardDropRequestQueries' });
  emailCardDropRequestSerializer = inject('email-card-drop-request-serializer', {
    as: 'emailCardDropRequestSerializer',
  });

  constructor() {
    autoBind(this);
  }

  async get(ctx: Koa.Context) {
    ctx.status = 200;
    ctx.body = 'You have verified your card drop request';
    return;
  }
}

declare module '@cardstack/hub/routes' {
  interface KnownRoutes {
    verify: EmailCardDropVerifyRoute;
  }
}
