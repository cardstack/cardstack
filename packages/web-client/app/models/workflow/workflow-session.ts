import { tracked } from '@glimmer/tracking';

export interface ArbitraryDictionary {
  [key: string]: any;
}
export default class WorkflowSession {
  @tracked state: ArbitraryDictionary = {};
  update(key: string, val: any) {
    this.state[key] = val;
    // eslint-disable-next-line no-self-assign
    this.state = this.state; // for reactivity
  }

  updateMany(hash: Record<string, any>) {
    for (const key in hash) {
      this.state[key] = hash[key];
    }
    // eslint-disable-next-line no-self-assign
    this.state = this.state; // for reactivity
  }

  delete(key: string) {
    delete this.state[key];
    // eslint-disable-next-line no-self-assign
    this.state = this.state; // for reactivity
  }
}
