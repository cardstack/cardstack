import { Prisma, PrismaClient } from '@prisma/client';

type NotificationPreferenceGetter = Prisma.NotificationPreferenceDelegate<any>;

interface NotificationPreferencesExtensions {
  findManyWithTypes({
    ownerAddress,
    pushClientId,
    notificationType,
  }: {
    ownerAddress: string;
    pushClientId?: string;
    notificationType?: string;
  }): NotificationPreferenceWithInlineType[];

  updateStatus(model: NotificationPreferenceWithInlineType): ReturnType<NotificationPreferenceGetter['upsert']>;
}

export interface ExtendedNotificationPreference
  extends NotificationPreferenceGetter,
    NotificationPreferencesExtensions {}

export interface NotificationPreferenceWithInlineType {
  ownerAddress: string;
  pushClientId: string;
  notificationType: string;
  status: 'enabled' | 'disabled';
}

export function getNotificationPreferenceExtension(client: PrismaClient) {
  return {
    async findManyWithTypes({
      ownerAddress,
      pushClientId,
      notificationType,
    }: {
      ownerAddress: string;
      pushClientId?: string;
      notificationType?: string;
    }) {
      let whereClause: Prisma.NotificationPreferenceWhereInput = {
        ownerAddress,
      };

      if (pushClientId) {
        whereClause.pushClientId = pushClientId;
      }

      if (notificationType) {
        whereClause.notificationType = {
          notificationType,
        };
      }

      let rows = await client.notificationPreference.findMany({
        select: {
          ownerAddress: true,
          pushClientId: true,
          status: true,
          notificationType: {
            select: {
              notificationType: true,
            },
          },
        },
        where: whereClause,
      });

      return rows.map((row) => ({
        ownerAddress: row.ownerAddress,
        pushClientId: row.pushClientId,
        status: row.status,
        notificationType: row.notificationType.notificationType,
      }));
    },

    async updateStatus(model: NotificationPreferenceWithInlineType) {
      let notificationTypeModel = await client.notificationType.findFirst({
        where: { notificationType: model.notificationType },
      });

      if (!notificationTypeModel) {
        throw new Error(
          `No notification_types record found with notification_type ${model.notificationType} to relate to notification_preferences record`
        );
      }

      let notificationTypeId = notificationTypeModel.id;

      return client.notificationPreference.upsert({
        where: {
          ownerAddress_notificationTypeId_pushClientId: {
            ownerAddress: model.ownerAddress,
            notificationTypeId: notificationTypeId,
            pushClientId: model.pushClientId,
          },
        },
        create: {
          ownerAddress: model.ownerAddress,
          notificationTypeId: notificationTypeId,
          pushClientId: model.pushClientId,
          status: model.status,
        },
        update: {
          status: model.status,
        },
      });
    },
  };
}
