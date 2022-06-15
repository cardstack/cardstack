import Koa from 'koa';
import autoBind from 'auto-bind';
import { query } from '@cardstack/hub/queries';
import { inject } from '@cardstack/di';

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
    let id = ctx.params.id;
    let jobTicket = await this.jobTicketsQueries.find(id);

    if (jobTicket) {
      ctx.body = this.jobTicketSerializer.serialize(jobTicket!);
      ctx.type = 'application/vnd.api+json';
      ctx.status = 200;
    } else {
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
    }
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'job-tickets-route': JobTicketsRoute;
  }
}
