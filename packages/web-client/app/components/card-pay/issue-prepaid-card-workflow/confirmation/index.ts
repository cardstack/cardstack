import Component from '@glimmer/component';
import { next } from '@ember/runloop';

interface CardPayIssuePrepaidCardWorkflowConfirmationComponentArgs {
  onComplete: () => void;
}

export default class CardPayDepositWorkflowConfirmationComponent extends Component<CardPayIssuePrepaidCardWorkflowConfirmationComponentArgs> {
  constructor(
    owner: unknown,
    args: CardPayIssuePrepaidCardWorkflowConfirmationComponentArgs
  ) {
    super(owner, args);
    next(this, () => {
      this.args.onComplete();
    });
  }
}
