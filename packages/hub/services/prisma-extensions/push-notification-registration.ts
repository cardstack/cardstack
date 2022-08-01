import { Prisma, PrismaClient } from '@prisma/client';

type PushNotificationRegistrationGetter = Prisma.PushNotificationRegistrationDelegate<any>;

interface PushNotificationRegistrationExtensions {
  upsertByOwnerAndPushClient({
    id,
    ownerAddress,
    pushClientId,
    disabledAt,
  }: {
    id: string;
    ownerAddress: string;
    pushClientId: string;
    disabledAt: Date | null;
  }): ReturnType<PushNotificationRegistrationGetter['upsert']>;
}

export interface ExtendedPushNotificationRegistration
  extends PushNotificationRegistrationGetter,
    PushNotificationRegistrationExtensions {}

export function getPushNotificationRegistrationExtension(client: PrismaClient) {
  return {
    upsertByOwnerAndPushClient({
      id,
      ownerAddress,
      pushClientId,
      disabledAt = null,
    }: {
      id: string;
      ownerAddress: string;
      pushClientId: string;
      disabledAt: Date | null;
    }) {
      return client.pushNotificationRegistration.upsert(
        Prisma.validator<Prisma.PushNotificationRegistrationUpsertArgs>()({
          where: {
            ownerAddress_pushClientId: {
              ownerAddress,
              pushClientId,
            },
          },
          create: {
            id: id,
            ownerAddress,
            pushClientId,
            disabledAt,
          },
          update: {
            disabledAt,
          },
        })
      );
    },
  };
}
