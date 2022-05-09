import { query } from '../queries';
import { service } from '@cardstack/hub/services';
import config from 'config';
import * as Sentry from '@sentry/node';

export default class DropCard {
  emailCardDropRequestQueries = query('email-card-drop-requests', { as: 'emailCardDropRequestQueries' });
  relay = service('relay');

  async perform({ id: requestId }: { id: string }) {
    let requests = await this.emailCardDropRequestQueries.query({ id: requestId });
    let request = requests[0];

    if (!request) {
      Sentry.captureException(new Error(`Could not find email card drop request with id ${requestId}`), {
        tags: {
          action: 'drop-card',
        },
      });

      return;
    }

    try {
      let transactionHash = await this.relay.provisionPrepaidCardV2(request.ownerAddress, config.get('cardDrop.sku'));

      await this.emailCardDropRequestQueries.updateTransactionHash(requestId, transactionHash);
    } catch (e) {
      Sentry.captureException(e, {
        tags: {
          action: 'drop-card',
        },
      });
    }
  }
}
