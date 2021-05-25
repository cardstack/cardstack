import { helper } from '@ember/component/helper';
import { WorkflowPostable } from '../models/workflow/workflow-postable';
import { WorkflowCard } from '../models/workflow/workflow-card';

// one minute
const maxIntervalInMilliseconds = 1000 * 60;

function postableMetaIdentical([postA, postB]: [
  WorkflowPostable | WorkflowCard,
  WorkflowPostable | WorkflowCard
]) {
  if (!postA || !postB) {
    return false;
  }

  let timeA = postA!.timestamp!.getTime();
  let timeB = postB!.timestamp!.getTime();
  let authorA = postA.author.name;
  let authorB = postB.author.name;

  let isSameGroup =
    Math.abs(timeB - timeA) < maxIntervalInMilliseconds && authorA === authorB;

  if (!isSameGroup) {
    return false;
  }

  let postAHasCard = Object.keys(postA).includes('componentName');
  let postBHasCard = Object.keys(postB).includes('componentName');

  if (postAHasCard || (!postAHasCard && !postBHasCard)) {
    return true;
  }

  return false;
}

export default helper(postableMetaIdentical);
