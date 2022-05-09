import { query } from '@cardstack/hub/queries';
import { service } from '@cardstack/hub/services';
import Logger from '@cardstack/logger';
import config from 'config';
import * as Sentry from '@sentry/node';

let log = Logger('task:drop-card');

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
      log.info(`Provisioning prepaid card for ${request.ownerAddress}`);
      let transactionHash = await this.relay.provisionPrepaidCardV2(request.ownerAddress, config.get('cardDrop.sku'));

      log.info(`Provisioned successfully, transaction hash: ${transactionHash}`);
      await this.emailCardDropRequestQueries.updateTransactionHash(requestId, transactionHash);
    } catch (e: any) {
      log.error(`Error provisioning prepaid card: ${e.toString()}`);
      Sentry.captureException(e, {
        tags: {
          action: 'drop-card',
        },
      });
    }
  }
}
