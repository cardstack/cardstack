import { inject } from '@cardstack/di';

export default class CreateProfile {
  workerClient = inject('worker-client', { as: 'workerClient' });

  async perform(_payload: any) {
    this.workerClient.addJob('persist-off-chain-merchant-info', { 'merchant-safe-id': 'fixme' });
  }
}
