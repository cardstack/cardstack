import Controller from '@ember/controller';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

export default class CardSpaceIndexController extends Controller {
  queryParams = ['flow', { workflowPersistenceId: 'flow-id' }];

  @tracked flow: string | null = null;
  @tracked workflowPersistenceId: string | null = null;

  @action transitionHome() {
    this.transitionToRoute('index');
  }

  @action transitionToWorkflow(flow: string) {
    this.transitionToRoute('card-space', {
      queryParams: { flow },
    });
  }

  @action resetQueryParams() {
    this.flow = null;
    this.workflowPersistenceId = null;
  }
}
