import Route from '@ember/routing/route';

export default class CardPayWorkflowRoute extends Route {
  model({ workflowId }) {
    let cardpay = this.modelFor('card-pay');
    let { user, workflows, bots } = cardpay;
    let workflow = workflows.find((el) => el.id === workflowId);
    let workflowBot = bots.find((b) =>
      workflow.workflowRepresentatives.includes(b.id)
    );

    let thread = {
      id: workflowId,
      participants: [user],
      orgRepresentatives: [workflowBot],
      workflow,
    };

    return thread;
  }
}
