import Koa from 'koa';
import autoBind from 'auto-bind';
import { inject } from '@cardstack/di';
import StatuspageApi from '../services/statuspage-api';
import crypto from 'crypto';
import config from 'config';
import { DEGRADED_THRESHOLD as degradedSubgraphThreshold } from '../routes/status';

// Check names and component names should map to the names and components in Checkly
type CheckName = 'hub-prod subgraph / RPC node block number diff within threshold';
type Checks = {
  [key in CheckName]: {
    componentName: 'Subgraph'; // Component name in Checkly
    incidentMessage: string; // Will be shown in Statuspage
  };
};

export default class ChecklyWebhookRoute {
  statuspageApi: StatuspageApi = inject('statuspage-api', { as: 'statuspageApi' });

  checks: Checks = {
    'hub-prod subgraph / RPC node block number diff within threshold': {
      componentName: 'Subgraph',
      incidentMessage: `We are experiencing blockchain indexing delays. The blockchain index is delayed by at least ${degradedSubgraphThreshold} blocks. This will result increased transaction processing times.`,
    },
  };

  constructor() {
    autoBind(this);
  }

  async post(ctx: Koa.Context) {
    let signature = ctx.headers['x-checkly-signature'] as string;
    let isTestEnv = process.env.NODE_ENV === 'test';

    if (!isTestEnv && (!signature || !this.isVerifiedPayload(JSON.stringify(ctx.request.body), signature))) {
      ctx.status = 401;
      ctx.body = 'Invalid signature';
      return;
    }

    let checkName = ctx.request.body.check_name as keyof Checks;
    let check = this.checks[checkName];

    if (check) {
      let alertType = ctx.request.body.alert_type;

      if (alertType === 'ALERT_FAILURE') {
        await this.statuspageApi.createIncident(check.componentName, check.incidentMessage);
      } else if (alertType == 'ALERT_RECOVERY') {
        await this.statuspageApi.resolveIncident(check.componentName);
      }

      ctx.status = 200;
      ctx.body = {};
    } else {
      ctx.status = 422;
      ctx.body = { error: `Unrecognized check name: ${checkName}` };
    }

    ctx.type = 'application/json';
  }

  private isVerifiedPayload(payload: string, signature: string) {
    const hmac = crypto.createHmac('sha256', config.get('checkly.webhookSecret'));
    const digest = hmac.update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'checkly-webhook-route': ChecklyWebhookRoute;
  }
}
