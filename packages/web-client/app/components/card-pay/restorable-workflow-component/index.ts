import { Workflow } from '@cardstack/web-client/models/workflow';
import WorkflowPersistence from '@cardstack/web-client/services/workflow-persistence';
import { getOwner } from '@ember/application';
import RouterService from '@ember/routing/router-service';
import Component from '@glimmer/component';
import { cached, tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';

interface WorkflowConstructor<TWorkflow> {
  new (owner?: any, workflowPersistenceId?: string): TWorkflow;
}

export default abstract class RestorableWorkflowComponent<
  TWorkflow extends Workflow
> extends Component {
  @service declare workflowPersistence: WorkflowPersistence;
  @service declare router: RouterService;
  @tracked isInitializing = true;

  get workflowPersistenceId() {
    return this.router.currentRoute.queryParams['flow-id']!;
  }

  abstract get workflowClass(): WorkflowConstructor<TWorkflow>;

  @cached
  get workflow() {
    const WorkflowClass = this.workflowClass;
    return new WorkflowClass(getOwner(this), this.workflowPersistenceId);
  }

  constructor(owner: unknown, args: {}) {
    super(owner, args);
    this.restore();
  }

  async restore() {
    await this.workflow.restore();
    this.isInitializing = false;
  }
}
