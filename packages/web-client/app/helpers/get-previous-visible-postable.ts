import { helper } from '@ember/component/helper';
import { WorkflowPostable } from '../models/workflow/workflow-postable';

function getPreviousVisiblePostable([postable]: [WorkflowPostable]) {
  if (!postable) {
    return null;
  }

  let workflowVisiblePostables = postable!.workflow!.peekAtVisiblePostables();
  let result = null;

  for (let candidate of workflowVisiblePostables) {
    if (candidate === postable) {
      return result;
    }

    if (!(candidate as any)._isCheck) {
      result = candidate;
    }
  }

  return null;
}

export default helper(getPreviousVisiblePostable);
