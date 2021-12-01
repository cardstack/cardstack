import { Helpers } from 'graphile-worker';

export default class SendNotificationsTask {
  async perform(payload: any, helpers: Helpers) {
    helpers.logger.info('Notification to send:', payload);
  }
}
