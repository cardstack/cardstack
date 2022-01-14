import type { Helpers } from 'graphile-worker';

export default async (_payload: any, _helpers: Helpers) => {
  throw new Error('Boom! Job with intentional failure has thrown this error.');
};
