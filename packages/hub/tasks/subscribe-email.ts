import { Helpers } from 'graphile-worker';

export default class SubscribeEmail {
  async perform(_payload: any, helpers: Helpers) {
    helpers.logger.info(`Placeholder for SubscribeEmail`);
  }
}
