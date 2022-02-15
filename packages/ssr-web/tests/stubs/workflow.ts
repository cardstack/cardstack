import { Workflow, WorkflowName } from '@cardstack/ssr-web/models/workflow';

export class WorkflowStub extends Workflow {
  name = 'WITHDRAWAL' as WorkflowName;
  version = 1;

  beforeRestorationChecks() {
    return [];
  }
}
