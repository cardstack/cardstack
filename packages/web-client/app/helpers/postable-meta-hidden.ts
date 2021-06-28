import { helper } from '@ember/component/helper';
import { postableMetaIdentical } from './postable-meta-identical';
import { WorkflowPostable } from '../models/workflow/workflow-postable';
import { WorkflowCard } from '../models/workflow/workflow-card';

function postableMetaHidden(
  [post]: [WorkflowPostable | WorkflowCard],
  { previous }: { previous: WorkflowPostable }
) {
  let isSameGroup = postableMetaIdentical([post, previous]);

  if (!isSameGroup) {
    return false;
  }

  let postHasCard = post instanceof WorkflowCard;
  let previousPostHasCard = previous instanceof WorkflowCard;

  if (postHasCard || (!postHasCard && !previousPostHasCard)) {
    return true;
  }

  return false;
}

export default helper(postableMetaHidden);
