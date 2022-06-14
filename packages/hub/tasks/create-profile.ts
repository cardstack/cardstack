import { inject } from '@cardstack/di';
import { service } from '@cardstack/hub/services';

export default class CreateProfile {
  relay = service('relay');
  workerClient = inject('worker-client', { as: 'workerClient' });

  async perform({
    'merchant-infos': { 'owner-address': ownerAddress },
  }: {
    'merchant-infos': { 'owner-address': string };
  }) {
    await this.relay.registerProfile(ownerAddress, 'fixme');

    this.workerClient.addJob('persist-off-chain-merchant-info', { 'merchant-safe-id': 'fixme' });
  }
}
