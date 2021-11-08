import { default as Service, inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import RouterService from '@ember/routing/router-service';
import { MockLocalStorage } from '../utils/browser-mocks';
import config from '../config/environment';
import { CardPayWorkflowName } from '../models/workflow';
import { CARD_PAY_WORKFLOW_NAMES } from '@cardstack/web-client/models/workflow';
import { WorkflowMeta } from '@cardstack/web-client/models/workflow/workflow-session';

export interface WorkflowPersistencePersistedData {
  name: string;
  state: any;
}
export interface WorkflowPersistenceMeta extends WorkflowMeta {
  id: string;
  name: string;
}

const WORKFLOW_NAMES_KEYS = Object.keys(CARD_PAY_WORKFLOW_NAMES);

const STORAGE_KEY_PREFIX = 'workflowPersistence';

export default class WorkflowPersistence extends Service {
  @service declare router: RouterService;

  #storage!: Storage | MockLocalStorage;
  __storage: MockLocalStorage | undefined;

  #handleStorageEvent: () => void;

  @tracked persistedDataIds: string[] = [];

  constructor() {
    super(...arguments);

    let entries: Record<string, string>;

    if (config.environment === 'test') {
      this.#storage = new MockLocalStorage();
      this.__storage = this.#storage;
      entries = this.#storage.entries;
    } else {
      this.#storage = window.localStorage;
      entries = this.#storage;
    }

    this.updatePersistedIds(entries);

    this.#handleStorageEvent = () => {
      this.updatePersistedIds(entries);
    };

    window.addEventListener('storage', this.#handleStorageEvent);
  }

  willDestroy() {
    window.removeEventListener('storage', this.#handleStorageEvent);
  }

  updatePersistedIds(entries: Record<string, string>) {
    this.persistedDataIds = Object.keys(entries)
      .filter((key) => key.startsWith(`${STORAGE_KEY_PREFIX}:`))
      .map((key) => key.replace(`${STORAGE_KEY_PREFIX}:`, ''));
  }

  getPersistedData(
    workflowPersistenceId: string
  ): WorkflowPersistencePersistedData {
    return JSON.parse(
      this.#storage.getItem(constructStorageKey(workflowPersistenceId)) || '{}'
    );
  }

  persistData(
    workflowPersistenceId: string,
    data: WorkflowPersistencePersistedData
  ) {
    if (this.persistedDataIds.includes(workflowPersistenceId)) {
      // Ensure WorkflowTracker::Item updates as well
      this.persistedDataIds = [...this.persistedDataIds];
    } else {
      this.persistedDataIds = [...this.persistedDataIds, workflowPersistenceId];
    }

    return this.#storage.setItem(
      constructStorageKey(workflowPersistenceId),
      JSON.stringify(data)
    );
  }

  get allValidWorkflows() {
    return this.persistedDataIds
      .reduce((workflows, id) => {
        let workflow = this.getPersistedData(id);

        if (
          workflow &&
          WORKFLOW_NAMES_KEYS.includes(workflow.name) &&
          workflow.state &&
          workflow.state.meta
        ) {
          let meta = parseMeta(workflow);

          if (meta.milestonesCount && meta.completedMilestonesCount) {
            workflows.push({ ...meta, id, name: workflow.name });
          }
        }

        return workflows;
      }, [] as WorkflowPersistenceMeta[])
      .sortBy('updatedAt')
      .reverse();
  }

  get activeWorkflows() {
    return this.allValidWorkflows.filter(
      (meta) =>
        meta.completedMilestonesCount! < meta.milestonesCount! &&
        !meta.isCanceled
    );
  }

  get completedWorkflows() {
    return this.allValidWorkflows.filter(
      (meta) =>
        meta.milestonesCount &&
        meta.completedMilestonesCount === meta.milestonesCount
    );
  }

  visitPersistedWorkflow(workflowPersistenceId: string) {
    let data = this.getPersistedData(workflowPersistenceId);
    let workflowName = data.name as CardPayWorkflowName;
    let route, flow;

    if (workflowName === 'PREPAID_CARD_ISSUANCE') {
      route = 'balances';
      flow = 'issue-prepaid-card';
    } else if (workflowName === 'MERCHANT_CREATION') {
      route = 'payments';
      flow = 'create-business';
    } else if (workflowName === 'RESERVE_POOL_DEPOSIT') {
      route = 'deposit-withdrawal';
      flow = 'deposit';
    } else if (workflowName === 'WITHDRAWAL') {
      route = 'deposit-withdrawal';
      flow = 'withdrawal';
    }

    this.router.transitionTo(`card-pay.${route}`, {
      queryParams: {
        flow,
        'flow-id': workflowPersistenceId,
      },
    });
  }

  clear() {
    this.persistedDataIds = [];
    this.#storage.clear();
  }

  clearWorkflowWithId(workflowPersistenceId: string) {
    this.persistedDataIds = this.persistedDataIds.without(
      workflowPersistenceId
    );
    const prefixedId = constructStorageKey(workflowPersistenceId);
    this.#storage.removeItem(prefixedId);
  }
}

export function constructStorageKey(workflowPersistenceId: string) {
  return `${STORAGE_KEY_PREFIX}:${workflowPersistenceId}`;
}

function parseMeta(data: WorkflowPersistencePersistedData) {
  return JSON.parse(data.state.meta).value;
}

declare module '@ember/service' {
  interface Registry {
    'workflow-persistence': WorkflowPersistence;
  }
}
