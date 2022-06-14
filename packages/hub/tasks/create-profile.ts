import { inject } from '@cardstack/di';
import { query } from '@cardstack/hub/queries';
import { service } from '@cardstack/hub/services';

export default class CreateProfile {
  jobTickets = query('job-tickets', { as: 'jobTickets' });
  relay = service('relay');
  workerClient = inject('worker-client', { as: 'workerClient' });

  async perform({
    'job-ticket-id': jobTicketId,
    'merchant-infos': { 'owner-address': ownerAddress },
  }: {
    'job-ticket-id': string;
    'merchant-infos': { 'owner-address': string };
  }) {
    let merchantSafeAddress = await this.relay.registerProfile(ownerAddress, 'fixme');

    await this.jobTickets.update(jobTicketId, { 'merchant-safe-id': merchantSafeAddress }, 'success');

    this.workerClient.addJob('persist-off-chain-merchant-info', { 'merchant-safe-id': 'fixme' });
  }
}
