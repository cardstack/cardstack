import WorkflowPersistence from '@cardstack/web-client/services/workflow-persistence';
import { tracked } from '@glimmer/tracking';

export interface ArbitraryDictionary {
  [key: string]: any;
}

export default class WorkflowSession {
  workflow: any;
  workflowPersistenceStorage: WorkflowPersistence | undefined;

  constructor(workflow?: any) {
    this.workflow = workflow;

    // Allow WorkflowSession to be instantiated as a POJO (for unit tests)
    if (this.workflow && typeof this.workflow.owner.lookup === 'function') {
      this.workflowPersistenceStorage = this.workflow.owner.lookup(
        'service:workflow-persistence'
      );
    }
  }

  @tracked state: ArbitraryDictionary = {};

  get isPersisted() {
    return !!this.workflow?.workflowPersistenceId;
  }

  update(key: string, val: any) {
    this.state[key] = val;
    // eslint-disable-next-line no-self-assign
    this.state = this.state; // for reactivity

    this.persistToStorage();
  }

  updateMany(hash: Record<string, any>) {
    for (const key in hash) {
      this.state[key] = hash[key];
    }
    // eslint-disable-next-line no-self-assign
    this.state = this.state; // for reactivity

    this.persistToStorage();
  }

  delete(key: string) {
    delete this.state[key];
    // eslint-disable-next-line no-self-assign
    this.state = this.state; // for reactivity

    this.persistToStorage();
  }

  restoreFromStorage(): void {
    if (!this.isPersisted) return;

    const persistedData = this.workflowPersistenceStorage?.getPersistedData(
      this.workflow.workflowPersistenceId
    );

    if (persistedData?.state) {
      this.state = persistedData.state;
    }
  }

  persistToStorage(): void {
    if (!this.isPersisted) return;

    this.workflowPersistenceStorage?.persistData(
      this.workflow.workflowPersistenceId,
      { name: this.workflow.name, state: this.state }
    );
  }
}
