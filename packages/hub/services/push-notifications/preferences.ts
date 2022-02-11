import { inject } from '@cardstack/di';
import { NotificationPreference } from '../../routes/notification-preferences';
import NotificationPreferenceQueries from '../queries/notification-preference';
import NotificationTypeQueries from '../queries/notification-type';

export default class NotificationPreferenceService {
  prismaClient = inject('prisma-client', { as: 'prismaClient' });
  notificationTypeQueries: NotificationTypeQueries = inject('notification-type-queries', {
    as: 'notificationTypeQueries',
  });
  notificationPreferenceQueries: NotificationPreferenceQueries = inject('notification-preference-queries', {
    as: 'notificationPreferenceQueries',
  });

  async getPreferences(ownerAddress: string, pushClientId?: string): Promise<NotificationPreference[]> {
    let prisma = await this.prismaClient.getClient();
    let notificationTypes = await this.notificationTypeQueries.query();
    let preferences = await this.notificationPreferenceQueries.query({
      ownerAddress,
    });

    let pushClientIds;

    if (!pushClientId) {
      let registrations = await prisma.pushNotificationRegistrations.findMany({
        where: { ownerAddress, disabledAt: null },
      });
      pushClientIds = registrations.map((registration) => registration.pushClientId);
    } else {
      pushClientIds = [pushClientId];
    }

    return pushClientIds.flatMap((pushClientId) => {
      return notificationTypes.map((nt) => {
        let preference = preferences.find(
          (preference) =>
            preference.pushClientId === pushClientId && preference.notificationType === nt.notificationType
        );
        if (!preference) {
          preference = {
            status: nt.defaultStatus,
            notificationType: nt.notificationType,
            ownerAddress: ownerAddress,
            pushClientId: pushClientId,
          };
        }
        return preference;
      });
    });
  }

  async getEligiblePushClientIds(ownerAddress: string, notificationType: string): Promise<string[]> {
    return (await this.getPreferences(ownerAddress))
      .filter((preference) => {
        return preference.notificationType === notificationType && preference.status === 'enabled';
      })
      .map((preference) => preference.pushClientId);
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'notification-preference-service': NotificationPreferenceService;
  }
}
