import Component from '@glimmer/component';
import { Emitter } from '@cardstack/ssr-web/utils/events';
import { registerDestructor } from '@ember/destroyable';

interface ListenerArgs {
  emitter: Emitter;
  event: string;
  action: Function;
}

export default class Listener extends Component<ListenerArgs> {
  constructor(owner: unknown, args: ListenerArgs) {
    super(owner, args);
    let unbind = this.args.emitter.on(this.args.event, this.args.action);
    registerDestructor(this, unbind);
  }
}
