import Koa from 'koa';
import autoBind from 'auto-bind';
import { inject } from '@cardstack/di';
import StatuspageApi from '../services/statuspage-api';

type CheckName = 'hub-prod subgraph / RPC node block number diff within threshold';
type Checks = {
  [key in CheckName]: {
    componentName: string; // Component name in Checkly
    incidentMessage: string; // Will be shown in Statuspage
  };
};

export default class ChecklyWebhookRoute {
  statuspageApi: StatuspageApi = inject('statuspage-api', { as: 'statuspageApi' });

  checks: Checks = {
    'hub-prod subgraph / RPC node block number diff within threshold': {
      componentName: 'Subgraph',
      incidentMessage: 'Subgraph block number is behind RPC block number by more than 10 blocks',
    },
  };

  constructor() {
    autoBind(this);
  }

  async post(ctx: Koa.Context) {
    let checkName = ctx.request.body.check_name as keyof Checks;
    let check = this.checks[checkName];

    if (check) {
      let alertType = ctx.request.body.alert_type;

      if (alertType === 'ALERT_FAILURE') {
        await this.statuspageApi.createIncident(check.componentName, check.incidentMessage);
      } else if (alertType == 'ALERT_RECOVERY') {
        await this.statuspageApi.resolveIncident(check.componentName);
      }
    }

    ctx.status = 200;
    ctx.body = {};
    ctx.type = 'application/vnd.api+json';
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'checkly-webhook-route': ChecklyWebhookRoute;
  }
}
