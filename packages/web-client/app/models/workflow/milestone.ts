import { Workflow } from '../workflow';
import { WorkflowPostable } from './workflow-postable';

interface MilestoneOptions {
  title: string;
  postables: WorkflowPostable[];
  completedDetail: string;
}
export class Milestone {
  title: string;
  postables: WorkflowPostable[] = [];
  #includedPostables = new Set<WorkflowPostable>();
  #excludedPostables = new Set<WorkflowPostable>();
  workflow: Workflow | undefined;
  setWorkflow(wf: Workflow) {
    this.workflow = wf;
    this.postables.invoke('setWorkflow', wf);
  }
  get isComplete() {
    return this.postables
      .filter((p) => {
        return !this.#excludedPostables.has(p);
      })
      .isEvery('isComplete', true);
  }
  completedDetail;

  constructor(opts: MilestoneOptions) {
    this.title = opts.title;
    this.postables = opts.postables;
    this.completedDetail = opts.completedDetail;
  }

  get visiblePostables() {
    let postablesArr = [];

    for (let i = 0; i < this.postables.length; i++) {
      let post = this.postables[i];
      if (this.#excludedPostables.has(post)) {
        continue;
      }
      if (
        post.includeIf &&
        !this.#includedPostables.has(post) &&
        post.includeIf() == false
      ) {
        this.#excludedPostables.add(post);
        continue;
      } else {
        this.#includedPostables.add(post);
        if (!post.timestamp) {
          post.timestamp = new Date();
        }
        postablesArr.push(post);
      }

      if (!post.isComplete) {
        break;
      }
    }

    return postablesArr;
  }
}
