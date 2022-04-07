import config from 'config';
import { Job, TaskSpec, WorkerUtils, makeWorkerUtils } from 'graphile-worker';

export default class WorkerClient {
  private workerUtils: WorkerUtils | undefined;

  private get dbConfig() {
    return config.get('db') as Record<string, any>;
  }

  async addJob(identifier: string, payload?: any, spec?: TaskSpec): Promise<Job> {
    if (this.workerUtils) {
      console.trace('Adding job', identifier, payload, spec);
      return this.workerUtils.addJob(identifier, payload, spec);
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
