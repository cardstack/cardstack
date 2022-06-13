import { Helpers } from 'graphile-worker';

export default class CreateProfile {
  async perform(_payload: any, helpers: Helpers) {
    helpers.logger.info(`Placeholder for CreateProfile`);
  }
}
