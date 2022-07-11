import { Prisma } from '@prisma/client';

export default function upsertPushNotificationRegistrationArgs(
  id: string,
  owner_address: string,
  push_client_id: string,
  disabled_at: Date | null
) {
  return Prisma.validator<Prisma.push_notification_registrationsUpsertArgs>()({
    where: {
      owner_address_push_client_id: {
        owner_address,
        push_client_id,
      },
    },
    create: {
      id: id,
      owner_address,
      push_client_id,
      disabled_at,
    },
    update: {
      disabled_at,
    },
  });
}
