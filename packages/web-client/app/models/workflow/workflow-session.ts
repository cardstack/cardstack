import { isPresent } from '@ember/utils';
import { tracked } from '@glimmer/tracking';

export interface ArbitraryDictionary {
  [key: string]: any;
}

export default class WorkflowSession {
  workflow: any;

  constructor(workflow?: any) {
    this.workflow = workflow;
  }

  @tracked state: ArbitraryDictionary = {};

  get hasPersistence() {
    return isPresent(this.workflow?.workflowPersistenceId);
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
    if (!this.hasPersistence) return;

    const persistedData = this.getPersistedData();

    if (persistedData?.state) {
      this.state = persistedData.state;
    }
  }

  getPersistedData(): any {
    return this.workflow?.workflowPersistence.getPersistedData(
      this.workflow.workflowPersistenceId
    );
  }

  private persistToStorage(): void {
    if (!this.hasPersistence) return;

    this.workflow?.workflowPersistence.persistData(
      this.workflow.workflowPersistenceId,
      { name: this.workflow.name, state: this.state }
    );
  }
}
