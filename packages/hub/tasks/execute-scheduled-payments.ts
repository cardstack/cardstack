import { inject } from '@cardstack/di';

export default class ExecuteScheduledPayments {
  private scheduledPaymentsExecutor = inject('scheduled-payment-executor', { as: 'scheduledPaymentsExecutor' });

  async perform() {
    await this.scheduledPaymentsExecutor.executeScheduledPayments();
  }
}

declare module '@cardstack/hub/tasks' {
  interface KnownTasks {
    'execute-scheduled-payments': ExecuteScheduledPayments;
  }
}
