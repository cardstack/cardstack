import Koa from 'koa';
import autoBind from 'auto-bind';
import { query } from '@cardstack/hub/queries';
import { ensureLoggedIn } from './utils/auth';
import { inject } from '@cardstack/di';
import shortUUID from 'short-uuid';

export interface JobTicket {
  id: string;
  jobType: string;
  ownerAddress: string;
  payload: any;
  result: any;
  state: string;
}

export default class JobTicketsRoute {
  jobTicketSerializer = inject('job-ticket-serializer', {
    as: 'jobTicketSerializer',
  });

  jobTicketsQueries = query('job-tickets', { as: 'jobTicketsQueries' });

  constructor() {
    autoBind(this);
  }

  async get(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }

    let id = ctx.params.id;
    let jobTicket = await this.jobTicketsQueries.find(id);

    if (!jobTicket) {
      ctx.body = {
        errors: [
          {
            status: '404',
            title: 'Job ticket not found',
            detail: `Could not find the job ticket ${id}`,
          },
        ],
      };
      ctx.type = 'application/vnd.api+json';
      ctx.status = 404;

      return;
    }

    let requestingUserAddress = ctx.state.userAddress;

    if (jobTicket.ownerAddress !== requestingUserAddress) {
      ctx.body = {
        errors: [
          {
            status: '401',
            title: 'No valid auth token',
          },
        ],
      };
      ctx.type = 'application/vnd.api+json';
      ctx.status = 401;

      return;
    }

    ctx.body = this.jobTicketSerializer.serialize(jobTicket!);
    ctx.type = 'application/vnd.api+json';
    ctx.status = 200;
  }

  async retry(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }

    let id = ctx.params.id;
    let jobTicketToRetry = await this.jobTicketsQueries.find(id);

    if (!jobTicketToRetry) {
      ctx.body = {
        errors: [
          {
            status: '404',
            title: 'Job ticket not found',
            detail: `Could not find the job ticket ${id}`,
          },
        ],
      };
      ctx.type = 'application/vnd.api+json';
      ctx.status = 404;

      return;
    }

    let requestingUserAddress = ctx.state.userAddress;

    if (jobTicketToRetry.ownerAddress !== requestingUserAddress) {
      ctx.body = {
        errors: [
          {
            status: '401',
            title: 'No valid auth token',
          },
        ],
      };
      ctx.type = 'application/vnd.api+json';
      ctx.status = 401;

      return;
    }

    let newJobTicket = {
      id: shortUUID.uuid(),
      jobType: jobTicketToRetry.jobType,
      ownerAddress: jobTicketToRetry.ownerAddress,
      payload: jobTicketToRetry.payload,
      result: null,
      state: 'pending', // FIXME hmm
    };

    await this.jobTicketsQueries.insert(newJobTicket);

    ctx.body = this.jobTicketSerializer.serialize(newJobTicket!);
    ctx.type = 'application/vnd.api+json';
    ctx.status = 201;
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'job-tickets-route': JobTicketsRoute;
  }
}
