import { helper } from '@ember/component/helper';
import { WorkflowPostable } from '../models/workflow';

function isPostableOnNewDay([postable]: [WorkflowPostable]) {
  if (!postable) {
    return false;
  }

  let workflowVisiblePostables = postable!.workflow!.peekAtVisiblePostables();

  let previousPostable =
    workflowVisiblePostables[workflowVisiblePostables.indexOf(postable) - 1];
  if (!previousPostable) {
    return true;
  }
  let previousDate = previousPostable.timestamp!.getDate();
  let postableDate = postable.timestamp!.getDate();
  return previousDate !== postableDate;
}

export default helper(isPostableOnNewDay);
