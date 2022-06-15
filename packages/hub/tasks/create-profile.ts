import { inject } from '@cardstack/di';
import { query } from '@cardstack/hub/queries';
import { service } from '@cardstack/hub/services';
import { encodeDID } from '@cardstack/did-resolver';
import * as Sentry from '@sentry/node';

export default class CreateProfile {
  jobTickets = query('job-tickets', { as: 'jobTickets' });
  merchantInfoQueries = query('merchant-info', {
    as: 'merchantInfoQueries',
  });
  relay = service('relay');
  workerClient = inject('worker-client', { as: 'workerClient' });

  async perform({
    'job-ticket-id': jobTicketId,
    'merchant-info-id': merchantInfoId,
  }: {
    'job-ticket-id': string;
    'merchant-info-id': string;
  }) {
    try {
      let merchantInfo = (await this.merchantInfoQueries.fetch({ id: merchantInfoId }))[0];
      let did = encodeDID({ type: 'MerchantInfo', uniqueId: merchantInfoId });

      let merchantSafeAddress = await this.relay.registerProfile(merchantInfo.ownerAddress, did);

      await this.jobTickets.update(jobTicketId, { 'merchant-safe-id': merchantSafeAddress }, 'success');

      this.workerClient.addJob('persist-off-chain-merchant-info', { 'merchant-safe-id': merchantInfoId });
    } catch (error) {
      Sentry.captureException(error);
      await this.jobTickets.update(jobTicketId, { error: (error as Error).toString() }, 'failed');
    }
  }
}
