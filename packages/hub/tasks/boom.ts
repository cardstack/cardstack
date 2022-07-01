import type { Helpers } from 'graphile-worker';

export default async function boomTask(_payload: any, _helpers: Helpers) {
  throw new Error('Boom! Job with intentional failure has thrown this error.');
}

declare module '@cardstack/hub/tasks' {
  interface KnownTasks {
    boom: typeof boomTask;
  }
}
