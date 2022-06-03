import { IWorkflowSession, Workflow } from '../workflow';
import PostableCollection from './postable-collection';
import { WorkflowPostable } from './workflow-postable';

interface MilestoneOptions {
  title: string;
  postables: WorkflowPostable[];
  completedDetail: string;
  editableIf?(session: IWorkflowSession): boolean;
}
export class Milestone {
  title: string;
  postableCollection: PostableCollection = new PostableCollection();
  editableIf?(session: IWorkflowSession): boolean;

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

  get isEditable() {
    return this.editableIf ? this.editableIf(this.workflow!.session) : true;
  }

  completedDetail;

  constructor(opts: MilestoneOptions) {
    this.title = opts.title;
    this.postableCollection.postables = opts.postables;
    this.completedDetail = opts.completedDetail;
    this.editableIf = opts.editableIf;
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
