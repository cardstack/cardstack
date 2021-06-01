import { Workflow } from '../workflow';
import PostableCollection from './postable-collection';
import { WorkflowPostable } from './workflow-postable';

interface MilestoneOptions {
  title: string;
  postables: WorkflowPostable[];
  completedDetail: string;
}
export class Milestone {
  title: string;
  postableCollection: PostableCollection = new PostableCollection();
  setWorkflow(wf: Workflow) {
    this.postableCollection.setWorkflow(wf);
  }
  get workflow() {
    return this.postableCollection.workflow;
  }
  get visiblePostables() {
    return this.postableCollection.visiblePostables;
  }

  get isComplete() {
    return this.postableCollection.isComplete;
  }

  completedDetail;

  constructor(opts: MilestoneOptions) {
    this.title = opts.title;
    this.postableCollection.postables = opts.postables;
    this.completedDetail = opts.completedDetail;
  }

  peekAtVisiblePostables() {
    return this.postableCollection.peekAtVisiblePostables();
  }

  indexOf(postable: WorkflowPostable) {
    return this.postableCollection.indexOf(postable);
  }

  resetFrom(start: number) {
    this.postableCollection.resetFrom(start);
  }
}
