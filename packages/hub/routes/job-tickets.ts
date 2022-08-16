import Koa from 'koa';
import autoBind from 'auto-bind';
import { ensureLoggedIn } from './utils/auth';
import { inject } from '@cardstack/di';
import shortUUID from 'short-uuid';
import { isKnownTask } from '@cardstack/hub/tasks';

export default class JobTicketsRoute {
  jobTicketSerializer = inject('job-ticket-serializer', {
    as: 'jobTicketSerializer',
  });

  prismaManager = inject('prisma-manager', { as: 'prismaManager' });
  workerClient = inject('worker-client', { as: 'workerClient' });

  constructor() {
    autoBind(this);
  }

  async list(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }

    let prisma = await this.prismaManager.getClient();
    let jobTickets = await prisma.jobTicket.findMany({ where: { ownerAddress: ctx.state.userAddress } });

    ctx.body = this.jobTicketSerializer.serialize(jobTickets);
    ctx.type = 'application/vnd.api+json';
    ctx.status = 200;
  }

  async get(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }
    let id = ctx.params.id;
    let prisma = await this.prismaManager.getClient();
    let jobTicket = await prisma.jobTicket.findUnique({ where: { id } });
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

    let prisma = await this.prismaManager.getClient();
    let id = ctx.params.id;
    let jobTicketToRetry = await prisma.jobTicket.findUnique({ where: { id } });

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
    if (!isKnownTask(jobTicketToRetry.jobType)) {
      throw new Error('not a known task');
    }
    let taskName = jobTicketToRetry.jobType;
    let payload = jobTicketToRetry.payload as any;
    let taskSpec = jobTicketToRetry.spec as any;
    this.workerClient.addJob(taskName, payload, taskSpec);

    let newJobTicket = await prisma.jobTicket.create({
      data: {
        id: shortUUID.uuid(),
        jobType: jobTicketToRetry.jobType,
        ownerAddress: jobTicketToRetry.ownerAddress,
        payload: jobTicketToRetry.payload ?? undefined,
        spec: jobTicketToRetry.spec ?? undefined,
      },
    });

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
