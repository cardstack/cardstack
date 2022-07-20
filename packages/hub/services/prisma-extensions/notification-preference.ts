import { NotificationPreference, Prisma, PrismaClient } from '@prisma/client';

type NotificationPreferenceGetter = Prisma.NotificationPreferenceDelegate<any>;

export interface ExtendedNotificationPreference extends NotificationPreferenceGetter {
  findManyWithKnownTypes({
    ownerAddress,
    pushClientId,
    notificationType,
  }: {
    ownerAddress: string;
    pushClientId?: string;
    notificationType?: string;
  }): ReturnType<NotificationPreferenceGetter['findMany']>;
  updateStatus(model: NotificationPreference): ReturnType<NotificationPreferenceGetter['upsert']>;
}

export interface NotificationPreferenceWithInlineType {
  ownerAddress: string;
  pushClientId: string;
  notificationType: string;
  status: 'enabled' | 'disabled';
}

export function getNotificationPreferenceExtension(client: PrismaClient) {
  return {
    async findManyWithKnownTypes({
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
        whereClause.notificationTypes = {
          notificationType,
        };
      }

      return client.notificationPreference.findMany({
        where: whereClause,
      });
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
