import Koa from 'koa';
import autoBind from 'auto-bind';
import { inject } from '@cardstack/di';
import PagerdutyApi from '../services/pagerduty-api';
import Logger from '@cardstack/logger';

const SUPPORTED_EVENT_TYPES = [
  'incident.acknowledged',
  'incident.resolved',
  'incident.triggered',
  'incident.unacknowledged',
];

let log = Logger('pagerduty-incidents-webhook');

export default class PagerdutyIncidentsWebhookRoute {
  pagerdutyApi: PagerdutyApi = inject('pagerduty-api', { as: 'pagerdutyApi' });
  workerClient = inject('worker-client', { as: 'workerClient' });

  constructor() {
    autoBind(this);
  }

  async post(ctx: Koa.Context) {
    let eventType = ctx.request.body.event?.event_type;
    log.info('Received pagerduty webhook', eventType);
    if (!SUPPORTED_EVENT_TYPES.includes(eventType)) {
      log.info(`Skipping handling PagerDuty request, unsupported event type ${eventType}`);
      ctx.status = 422;
      ctx.body = 'Unsupported event type';
      return;
    }

    let resourceType = ctx.request.body.event?.resource_type;
    if (resourceType !== 'incident') {
      log.info('Skipping handling PagerDuty request, unsupported resource type');
      ctx.status = 422;
      ctx.body = 'Unsupported resource type';
      return;
    }

    let incidentId = ctx.request.body.event.data.id;
    let incident = await this.pagerdutyApi.fetchIncident(incidentId);

    await this.workerClient.addJob('discord-post', {
      channel: 'on-call-internal',
      message: `${eventType}: ${incident.title} (${incident.html_url})`,
    });

    ctx.status = 200;
    ctx.body = {};

    ctx.type = 'application/json';
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'pagerduty-incidents-webhook-route': PagerdutyIncidentsWebhookRoute;
  }
}
