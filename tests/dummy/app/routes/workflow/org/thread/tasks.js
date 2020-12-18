import Route from '@ember/routing/route';

export default class WorkflowOrgThreadTasksRoute extends Route {
  async model() {
    let { user, thread, participants } = this.modelFor('workflow.org.thread');

    return {
      user,
      thread,
      participants
    }
  }
}
