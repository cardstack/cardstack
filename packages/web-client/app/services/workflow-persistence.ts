import { default as Service } from '@ember/service';

export default class WorkflowPersistence extends Service {
  getPersistedState(workflowPersistenceId: string) {
    return JSON.parse(
      localStorage.getItem(`workflowPersistence:${workflowPersistenceId}`) ||
        '{}'
    );
  }

  persistState(workflowPersistenceId: string, state: any) {
    return localStorage.setItem(
      `workflowPersistence:${workflowPersistenceId}`,
      JSON.stringify(state)
    );
  }
}

declare module '@ember/service' {
  interface Registry {
    'workflow-persistence': WorkflowPersistence;
  }
}
