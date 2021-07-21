import Component from '@glimmer/component';

interface ChainChangeModalArgs {
  title: string;
  message: string;
  dismissable: boolean;
}

export default class ChainChangeModal extends Component<ChainChangeModalArgs> {
  get title() {
    return this.args.title;
  }

  get message() {
    return this.args.message;
  }

  get isDismissable() {
    return this.args.dismissable;
  }
}
