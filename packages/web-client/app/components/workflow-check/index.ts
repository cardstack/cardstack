import Component from '@glimmer/component';

interface WorkflowCheckArgs {
  onComplete: () => void;
  check: () => Promise<boolean>;
  cancel: () => void;
}

export default class WorkflowCheck extends Component<WorkflowCheckArgs> {
  constructor(owner: unknown, args: any) {
    super(owner, args);
    this.args.check().then((v) => {
      if (v) {
        this.args.onComplete();
      } else {
        this.args.cancel();
      }
    });
  }
}
