import { query } from '@cardstack/hub/queries';
import { inject } from '@cardstack/di';
import { NotificationPreference } from '../../routes/notification-preferences';

export default class NotificationPreferenceService {
  notificationTypeQueries = query('notification-type', {
    as: 'notificationTypeQueries',
  });
  notificationPreferenceQueries = query('notification-preference', {
    as: 'notificationPreferenceQueries',
  });
  prismaManager = inject('prisma-manager', { as: 'prismaManager' });

  async getPreferences(ownerAddress: string, pushClientId?: string): Promise<NotificationPreference[]> {
    let prismaClient = await this.prismaManager.getClient();

    let notificationTypes = await this.notificationTypeQueries.query();
    let preferences = await this.notificationPreferenceQueries.query({
      ownerAddress,
    });

    let pushClientIds;

    if (!pushClientId) {
      let registrations = await prismaClient.push_notification_registrations.findMany({
        where: { owner_address: ownerAddress, disabled_at: null },
      });
      pushClientIds = registrations.map((registration) => registration.push_client_id);
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
