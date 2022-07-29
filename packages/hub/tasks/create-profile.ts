import { inject } from '@cardstack/di';
import { service } from '@cardstack/hub/services';
import { encodeDID } from '@cardstack/did-resolver';
import * as Sentry from '@sentry/node';
import config from 'config';
import logger from '@cardstack/logger';

const log = logger('hub/worker');

const network = config.get('web3.layer2Network') as string;

const merchantCreationsQuery = `
  query($txn: String!) {
    transaction(id: $txn) {
      merchantCreations {
        merchant {
          id
        }
        merchantSafe {
          id
        }
      }
    }
  }
`;

export default class CreateProfile {
  cardpay = inject('cardpay');
  prismaManager = inject('prisma-manager', { as: 'prismaManager' });

  relay = service('relay');
  web3 = inject('web3-http', { as: 'web3' });
  workerClient = inject('worker-client', { as: 'workerClient' });

  async perform({
    'job-ticket-id': jobTicketId,
    'merchant-info-id': merchantInfoId,
  }: {
    'job-ticket-id': string;
    'merchant-info-id': string;
  }) {
    let prisma = await this.prismaManager.getClient();

    try {
      let merchantInfo = await prisma.merchantInfo.findUnique({ where: { id: merchantInfoId } });
      let did = encodeDID({ type: 'MerchantInfo', uniqueId: merchantInfoId });

      let profileRegistrationTxHash = await this.relay.registerProfile(merchantInfo!.ownerAddress, did);

      await this.cardpay.waitForTransactionConsistency(this.web3.getInstance(), profileRegistrationTxHash);

      let merchantCreationsSubgraphResult = await this.cardpay.gqlQuery(network, merchantCreationsQuery, {
        txn: profileRegistrationTxHash,
      });

      let transaction = merchantCreationsSubgraphResult.data.transaction;

      if (!transaction) {
        throw new Error(`subgraph query for transaction ${profileRegistrationTxHash} returned no results`);
      }

      await prisma.jobTicket.update({
        where: { id: jobTicketId },
        data: {
          result: {
            id: merchantCreationsSubgraphResult.data.transaction.merchantCreations[0].merchantSafe.id,
          },
          state: 'success',
        },
      });

      this.workerClient.addJob('persist-off-chain-merchant-info', { id: merchantInfoId });
    } catch (error) {
      let errorString = (error as Error).toString();
      Sentry.captureException(error);
      log.error(errorString);
      await prisma.jobTicket.update({
        where: { id: jobTicketId },
        data: {
          result: {
            error: errorString,
          },
          state: 'failed',
        },
      });
    }
  }
}

declare module '@cardstack/hub/tasks' {
  interface KnownTasks {
    'create-profile': CreateProfile;
  }
}
