import { Helpers } from 'graphile-worker';
import * as Sentry from '@sentry/node';
import { inject } from '@cardstack/di';

/**
 * Meant to be used as a cron job. Deletes week-old sent notifications
 */
export default class RemoveOldSentNotifications {
  private databaseManager = inject('database-manager', { as: 'databaseManager' });
  async perform(payload: any, helpers: Helpers) {
    try {
      // keep cron-specific payload properties optional in case we decide to run this job manually
      if (payload._cron)
        helpers.logger.info(
          `Running task to remove old sent notifications scheduled for ISO timestamp: ${payload._cron.ts}`
        );

      let db = await this.databaseManager.getClient();

      const {
        rows: [{ timestamp: oldestNotificationTimestamp }],
      } = await db.query(`
        SELECT (NOW() - INTERVAL '1 WEEK')::timestamp;
      `);

      helpers.logger.info(
        `Will delete notifications sent before ISO timestamp: ${new Date(oldestNotificationTimestamp).toISOString()}`
      );

      await db.query(`DELETE FROM sent_push_notifications WHERE created_at < (NOW() - INTERVAL '1 WEEK')::timestamp;`);

      helpers.logger.info('Deleted old sent notifications');
    } catch (e) {
      Sentry.captureException(e, {
        tags: {
          action: 'remove-old-sent-notifications',
        },
      });
      helpers.logger.error('Failed to delete old sent notifications');
      throw e;
    }
  }
}
