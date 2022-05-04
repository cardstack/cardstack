import { Helpers } from 'graphile-worker';

export default class NotifyPrepaidCardDrop {
  async perform(_payload: any, helpers: Helpers) {
    helpers.logger.info(`Placeholder for NotifyPrepaidCardDrop`);
  }
}
