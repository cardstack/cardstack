import { Helpers } from 'graphile-worker';

export default async (payload: any, helpers: Helpers) => {
  const { name } = payload;
  helpers.logger.info(`Hello, ${name}!!!!`);
};
