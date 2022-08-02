import { EmailCardDropRequest, Prisma, PrismaClient } from '@prisma/client';
import { Clock } from '../clock';
import config from 'config';

const emailVerificationLinkExpiryMinutes: number = config.get('cardDrop.email.expiryMinutes');

type EmailCardDropRequestGetter = Prisma.EmailCardDropRequestDelegate<any>;

interface EmailCardDropRequestExtensions {
  findManyWithExpiry(
    options: Prisma.EmailCardDropRequestFindManyArgs,
    clock: Clock
  ): Promise<EmailCardDropRequestWithExpiry[]>;
  latestRequestForOwner(ownerAddress: string, clock: Clock): Promise<EmailCardDropRequestWithExpiry>;
  activeReservations(clock: Clock): Promise<number>;
  claimedInLastMinutes(minutes: number, clock: Clock): Promise<EmailCardDropRequestWithExpiry[]>;
}

export interface ExtendedEmailCardDropRequest extends EmailCardDropRequestGetter, EmailCardDropRequestExtensions {}

export interface EmailCardDropRequestWithExpiry extends EmailCardDropRequest {
  isExpired: boolean;
}

export function getEmailCardDropRequestExtension(client: PrismaClient) {
  let extension: EmailCardDropRequestExtensions = {
    async findManyWithExpiry(options: Prisma.EmailCardDropRequestFindManyArgs, clock: Clock) {
      return (await client.emailCardDropRequest.findMany(options)).map((model) => extendModel(model, clock));
    },

    async latestRequestForOwner(ownerAddress: string, clock: Clock) {
      let requests: EmailCardDropRequest[] = await client.$queryRaw`
        SELECT *
        FROM email_card_drop_requests AS t1
        WHERE
          owner_address=${ownerAddress} AND
          requested_at=(
            SELECT MAX(requested_at)
            FROM email_card_drop_requests
            WHERE t1.owner_address=email_card_drop_requests.owner_address
          )
      `;
      let model = await client.emailCardDropRequest.findUnique({ where: { id: requests[0].id } });
      return extendModel(model!, clock);
    },

    async activeReservations(clock: Clock) {
      let expiryEpoch = clock.now() / 1000 - emailVerificationLinkExpiryMinutes * 60;

      let result: any = await client.$queryRaw`
        SELECT COUNT(DISTINCT owner_address) FROM email_card_drop_requests
        WHERE
          owner_address NOT IN (
            SELECT DISTINCT owner_address
            FROM email_card_drop_requests
            WHERE claimed_at IS NOT NULL
          ) AND
          extract(epoch from requested_at) > ${expiryEpoch}
      `;

      return result[0].count;
    },

    async claimedInLastMinutes(minutes: number, clock: Clock) {
      let epochBeforeNow = clock.now() / 1000 - minutes * 60;

      let result: any = await client.$queryRaw`
        SELECT COUNT(*) FROM email_card_drop_requests
        WHERE EXTRACT(EPOCH FROM claimed_at) > ${epochBeforeNow}
      `;

      return result[0].count;
    },
  };

  return extension;
}

function extendModel(model: EmailCardDropRequest, clock: Clock) {
  let expiryDate = new Date(clock.now() - emailVerificationLinkExpiryMinutes * 1000 * 60);

  return {
    ...model,
    isExpired: !model.claimedAt && model.requestedAt < expiryDate,
  };
}
