import { default as Service, inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import RouterService from '@ember/routing/router-service';
import { MockLocalStorage } from '../utils/browser-mocks';
import config from '../config/environment';
import { WorkflowName } from '../models/workflow';
import { WORKFLOW_NAMES } from '@cardstack/web-client/models/workflow';
import { WorkflowMeta } from '@cardstack/web-client/models/workflow/workflow-session';

export interface WorkflowPersistencePersistedData {
  name: string;
  state: any;
}
export interface WorkflowPersistenceMeta extends WorkflowMeta {
  id: string;
  name: string;
}

const WORKFLOW_NAMES_KEYS = Object.keys(WORKFLOW_NAMES);

export const STORAGE_KEY_PREFIX = 'workflowPersistence';

export default class WorkflowPersistence extends Service {
  @service declare router: RouterService;

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
    if (this.persistedDataIds.includes(workflowPersistenceId)) {
      // Ensure WorkflowTracker::Item updates as well
      this.persistedDataIds = [...this.persistedDataIds];
    } else {
      this.persistedDataIds = [...this.persistedDataIds, workflowPersistenceId];
    }

    return this.#storage.setItem(
      `${STORAGE_KEY_PREFIX}:${workflowPersistenceId}`,
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
      (meta) => meta.completedMilestonesCount! < meta.milestonesCount!
    );
  }

  get completedWorkflows() {
    return this.allValidWorkflows.filter(
      (meta) =>
        meta.milestonesCount &&
        meta.completedMilestonesCount === meta.milestonesCount
    );
  }

  @action clearCompletedWorkflows() {
    this.completedWorkflows.forEach((workflowAndId) => {
      this.clearWorkflowWithId(workflowAndId.id);
    });
  }

  visitPersistedWorkflow(workflowPersistenceId: string) {
    let data = this.getPersistedData(workflowPersistenceId);
    let workflowName = data.name as WorkflowName;
    let route, flow;

    if (workflowName === 'PREPAID_CARD_ISSUANCE') {
      route = 'balances';
      flow = 'issue-prepaid-card';
    } else if (workflowName === 'MERCHANT_CREATION') {
      route = 'merchant-services';
      flow = 'create-merchant';
    } else if (workflowName === 'RESERVE_POOL_DEPOSIT') {
      route = 'token-suppliers';
      flow = 'deposit';
    } else if (workflowName === 'WITHDRAWAL') {
      route = 'token-suppliers';
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

  clearWorkflowWithId(id: string) {
    this.persistedDataIds = this.persistedDataIds.without(id);
    const prefixedId = `${STORAGE_KEY_PREFIX}:${id}`;
    this.#storage.removeItem(prefixedId);
  }
}

function parseMeta(data: WorkflowPersistencePersistedData) {
  return JSON.parse(data.state.meta).value;
}

declare module '@ember/service' {
  interface Registry {
    'workflow-persistence': WorkflowPersistence;
  }
}
