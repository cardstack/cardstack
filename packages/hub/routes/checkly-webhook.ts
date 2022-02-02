import Koa from 'koa';
import autoBind from 'auto-bind';
import { inject } from '@cardstack/di';
import StatuspageApi from '../services/statuspage-api';
import crypto from 'crypto';
import config from 'config';
import { DEGRADED_THRESHOLD as degradedSubgraphThreshold } from '../routes/status';

// Check names and component names should map to the names and components in Checkly
type CheckName =
  | 'hub-prod subgraph / RPC node block number diff within threshold'
  | 'xdai archive health check (eth_blockNumber)'
  | 'xdai non-archive health check - late-cold-smoke (eth_blockNumber)'
  | 'relay-production health check';
type ComponentName =
  | 'Subgraph'
  | 'Archive RPC node'
  | 'RPC node (non-archive)'
  | 'Hub'
  | 'Relay server'
  | 'Notifications';
type Checks = {
  [key in CheckName]: {
    componentName: ComponentName; // Component name in Statuspage
    incidentName: string; // Incident name in Statuspage
    incidentMessage: string; // Incident message in Statuspage
  };
};

export default class ChecklyWebhookRoute {
  statuspageApi: StatuspageApi = inject('statuspage-api', { as: 'statuspageApi' });

  checks: Checks = {
    'hub-prod subgraph / RPC node block number diff within threshold': {
      componentName: 'Subgraph',
      incidentName: 'Transactions delayed',
      incidentMessage: `We are experiencing blockchain indexing delays. The blockchain index is delayed by at least ${degradedSubgraphThreshold} blocks. This will result increased transaction processing times.`,
    },
    'xdai archive health check (eth_blockNumber)': {
      componentName: 'Archive RPC node',
      incidentName: 'RPC Node Degradation',
      incidentMessage:
        'We are experiencing degraded service with our archive RPC node. This will result in reduced transaction processing times.',
    },
    'xdai non-archive health check - late-cold-smoke (eth_blockNumber)': {
      componentName: 'RPC node (non-archive)',
      incidentName: 'RPC Node Degradation',
      incidentMessage:
        'We are experiencing degraded service with our non-archive RPC node. This will result in reduced application performance.',
    },
    'relay-production health check': {
      componentName: 'Relay server',
      incidentName: 'Relay Server Degradation',
      incidentMessage:
        'We are experiencing degraded service with our relay server. This will result in transaction processing failures.',
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

      if (['ALERT_DEGRADED', 'ALERT_FAILURE'].includes(alertType)) {
        await this.statuspageApi.createIncident(check.componentName, check.incidentName, check.incidentMessage);
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
