import { Helpers } from 'graphile-worker';

export default class DropCard {
  async perform(_payload: any, helpers: Helpers) {
    helpers.logger.info(`Placeholder for DropCard`);
  }
}
