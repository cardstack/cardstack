import { KnownTasks } from '@cardstack/hub/tasks';
import config from 'config';
import { Job, TaskSpec, WorkerUtils, makeWorkerUtils } from 'graphile-worker';

export default class WorkerClient {
  private workerUtils: WorkerUtils | undefined;
  defaultPriorities: Partial<Record<keyof KnownTasks, number>> = {
    'notify-customer-payment': 1,
    'notify-merchant-claim': 1,
    'notify-prepaid-card-drop': 1,
  };

  private get dbConfig() {
    return config.get('db') as Record<string, any>;
  }

  async addJob<T extends keyof KnownTasks>(
    identifier: T,
    payload?: KnownTasks[T] extends { perform(payload: any, helpers?: any): any }
      ? Parameters<KnownTasks[T]['perform']>[0]
      : KnownTasks[T] extends (payload: any, helpers?: any) => any
      ? Parameters<KnownTasks[T]>[0]
      : never,
    spec?: TaskSpec
  ): Promise<Job> {
    if (this.workerUtils) {
      // if there's a priority provided externally, respect it
      // otherwise, we want to lower some tasks' priorities so they don't crowd out others
      // scenario where this happens: restarting a hub-event-listener floods the job queue with notifications
      let priority = spec?.priority ?? this.defaultPriorities[identifier];
      let mergedSpec = {
        ...spec,
        priority,
      };
      console.trace('Adding job', identifier, payload, mergedSpec);
      return this.workerUtils.addJob(identifier, payload, mergedSpec);
    } else {
      throw new Error('Cannot call addJob before workerUtils is ready');
    }
  }

  async ready() {
    this.workerUtils = await makeWorkerUtils({
      connectionString: this.dbConfig.url,
    });
  }

  async teardown() {
    await this.workerUtils?.release();
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'worker-client': WorkerClient;
  }
}
