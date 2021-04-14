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
  includedPostables = new Set<WorkflowPostable>();
  excludedPostables = new Set<WorkflowPostable>();
  workflow: Workflow | undefined;
  setWorkflow(wf: Workflow) {
    this.workflow = wf;
    this.postables.invoke('setWorkflow', wf);
  }
  get isComplete() {
    return this.postables.isEvery('isComplete', true);
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
      if (!post.timestamp) {
        post.timestamp = new Date();
      }
      if (this.excludedPostables.has(post)) {
        continue;
      }
      if (
        post.includeIf &&
        !this.includedPostables.has(post) &&
        post.includeIf() == false
      ) {
        this.excludedPostables.add(post);
      } else {
        this.includedPostables.add(post);
        postablesArr.push(post);
      }

      if (!post.isComplete) {
        break;
      }
    }

    return postablesArr;
  }
}
