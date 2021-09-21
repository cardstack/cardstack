import { default as Service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { MockLocalStorage } from '../utils/browser-mocks';
import config from '../config/environment';

interface WorkflowPersistencePersistedData {
  name: string;
  state: any;
}

const STORAGE_KEY_PREFIX = 'workflowPersistence';

export default class WorkflowPersistence extends Service {
  #storage!: Storage | MockLocalStorage;

  @tracked persistedDataIds: string[] = [];

  constructor() {
    super(...arguments);
    if (config.environment === 'test') {
      this.#storage = new MockLocalStorage();
    } else {
      this.#storage = window.localStorage;
    }
  }

  getPersistedData(workflowPersistenceId: string) {
    return JSON.parse(
      this.#storage.getItem(`${STORAGE_KEY_PREFIX}:${workflowPersistenceId}`) ||
        '{}'
    );
  }

  persistData(
    workflowPersistenceId: string,
    data: WorkflowPersistencePersistedData
  ) {
    this.persistedDataIds = [...this.persistedDataIds, workflowPersistenceId];

    return this.#storage.setItem(
      `${STORAGE_KEY_PREFIX}:${workflowPersistenceId}`,
      JSON.stringify(data)
    );
  }

  clear() {
    this.persistedDataIds = [];
    this.#storage.clear();
  }
}

declare module '@ember/service' {
  interface Registry {
    'workflow-persistence': WorkflowPersistence;
  }
}
