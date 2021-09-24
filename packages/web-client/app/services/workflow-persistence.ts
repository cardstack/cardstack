import { default as Service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { MockLocalStorage } from '../utils/browser-mocks';
import config from '../config/environment';

export interface WorkflowPersistencePersistedData {
  name: string;
  state: any;
}

export const STORAGE_KEY_PREFIX = 'workflowPersistence';

export default class WorkflowPersistence extends Service {
  #storage!: Storage | MockLocalStorage;

  @tracked persistedDataIds: string[] = [];

  constructor() {
    super(...arguments);

    let entries;

    if (config.environment === 'test') {
      this.#storage = new MockLocalStorage();
      entries = this.#storage.entries;
    } else {
      this.#storage = window.localStorage;
      entries = this.#storage;
    }

    // FIXME extract function to construct compound key instead of exporting prefix?
    this.persistedDataIds = Object.keys(entries)
      .filter((key) => key.startsWith(`${STORAGE_KEY_PREFIX}:`))
      .map((key) => key.replace(`${STORAGE_KEY_PREFIX}:`, ''));
  }

  getPersistedData(
    workflowPersistenceId: string
  ): WorkflowPersistencePersistedData {
    return JSON.parse(
      this.#storage.getItem(`${STORAGE_KEY_PREFIX}:${workflowPersistenceId}`) ||
        '{}'
    );
  }

  persistData(
    workflowPersistenceId: string,
    data: WorkflowPersistencePersistedData
  ) {
    if (!this.persistedDataIds.includes(workflowPersistenceId)) {
      this.persistedDataIds = [...this.persistedDataIds, workflowPersistenceId];
    }

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
