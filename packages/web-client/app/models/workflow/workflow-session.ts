import { tracked } from '@glimmer/tracking';

interface ArbitraryDictionary {
  [key: string]: any;
}
export default class WorkflowSession {
  @tracked state: ArbitraryDictionary = {};
  update(key: string, val: any) {
    this.state[key] = val;
    // eslint-disable-next-line no-self-assign
    this.state = this.state; // for reactivity
  }
}
