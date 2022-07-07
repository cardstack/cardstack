import Koa from 'koa';
import autoBind from 'auto-bind';
import { query } from '@cardstack/hub/queries';
import { ensureLoggedIn } from './utils/auth';
import { inject } from '@cardstack/di';
import shortUUID from 'short-uuid';
import { KnownTasks } from '@cardstack/hub/tasks';

export interface JobTicket {
  id: string;
  jobType: keyof KnownTasks; // TODO: how do we know that this is true?
  ownerAddress: string;
  payload: any;
  result: any;
  spec: any;
  state?: string;
  sourceArguments?: any;
}

export default class JobTicketsRoute {
  jobTicketSerializer = inject('job-ticket-serializer', {
    as: 'jobTicketSerializer',
  });

  jobTicketsQueries = query('job-tickets', { as: 'jobTicketsQueries' });
  workerClient = inject('worker-client', { as: 'workerClient' });

  constructor() {
    autoBind(this);
  }

  async get(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }

    let id = ctx.params.id;
    let jobTicket = await this.jobTicketsQueries.find({ id });

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
    let jobTicketToRetry = await this.jobTicketsQueries.find({ id });

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

    if (jobTicketToRetry.state !== 'failed') {
      ctx.body = {
        errors: [
          {
            status: '422',
            title: `Can only retry a job with failed state (current state: ${jobTicketToRetry.state})`,
          },
        ],
      };
      ctx.type = 'application/vnd.api+json';
      ctx.status = 422;

      return;
    }

    this.workerClient.addJob(jobTicketToRetry.jobType, jobTicketToRetry.payload, jobTicketToRetry.spec);

    let newJobTicket: JobTicket | null = {
      id: shortUUID.uuid(),
      jobType: jobTicketToRetry.jobType,
      ownerAddress: jobTicketToRetry.ownerAddress,
      payload: jobTicketToRetry.payload,
      result: null,
      spec: jobTicketToRetry.spec,
    };

    newJobTicket = await this.jobTicketsQueries.insert(newJobTicket);

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
