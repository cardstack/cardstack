import { Helpers } from 'graphile-worker';

export default class SendEmailCardDropVerification {
  async perform(_payload: any, helpers: Helpers) {
    helpers.logger.info(`Placeholder for SendEmailCardDropVerification`);
  }
}
