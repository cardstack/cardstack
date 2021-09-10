import { default as Service } from '@ember/service';
import { MockLocalStorage } from '../utils/browser-mocks';
import config from '../config/environment';

interface WorkflowPersistencePersistedData {
  name: string;
  state: any;
}

export default class WorkflowPersistence extends Service {
  storage!: Storage | MockLocalStorage;

  constructor() {
    super(...arguments);
    if (config.environment === 'test') {
      this.storage = new MockLocalStorage();
    } else {
      this.storage = window.localStorage;
    }
  }

  getPersistedData(workflowPersistenceId: string) {
    return JSON.parse(
      this.storage.getItem(`workflowPersistence:${workflowPersistenceId}`) ||
        '{}'
    );
  }

  persistData(
    workflowPersistenceId: string,
    data: WorkflowPersistencePersistedData
  ) {
    return this.storage.setItem(
      `workflowPersistence:${workflowPersistenceId}`,
      JSON.stringify(data)
    );
  }
}

declare module '@ember/service' {
  interface Registry {
    'workflow-persistence': WorkflowPersistence;
  }
}
