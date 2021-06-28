import { helper } from '@ember/component/helper';
import { WorkflowPostable } from '../models/workflow/workflow-postable';

function isPostableOnNewDay(
  [postable]: [WorkflowPostable],
  { previous }: { previous: WorkflowPostable }
) {
  if (!postable) {
    return false;
  }

  if (!previous) {
    return true;
  }
  let previousDate = previous.timestamp!.getDate();
  let postableDate = postable.timestamp!.getDate();
  return previousDate !== postableDate;
}

export default helper(isPostableOnNewDay);
