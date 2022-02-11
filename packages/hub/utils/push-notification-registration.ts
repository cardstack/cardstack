import { Prisma } from '@prisma/client';

export default function upsertPushNotificationRegistrationArgs(
  id: string,
  ownerAddress: string,
  pushClientId: string,
  disabledAt: Date | null
) {
  return Prisma.validator<Prisma.PushNotificationRegistrationsUpsertArgs>()({
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
  });
}
