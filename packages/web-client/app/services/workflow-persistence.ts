import { default as Service } from '@ember/service';

interface WorkflowPersistencePersistedData {
  name: string;
  state: any;
}

export default class WorkflowPersistence extends Service {
  getPersistedData(workflowPersistenceId: string) {
    return JSON.parse(
      localStorage.getItem(`workflowPersistence:${workflowPersistenceId}`) ||
        '{}'
    );
  }

  persistData(
    workflowPersistenceId: string,
    data: WorkflowPersistencePersistedData
  ) {
    return localStorage.setItem(
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
