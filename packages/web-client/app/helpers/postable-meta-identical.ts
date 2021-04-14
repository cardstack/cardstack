import { helper } from '@ember/component/helper';
import { WorkflowPostable } from '../models/workflow/workflow-postable';

function postableMetaIdentical([postA, postB]: [
  WorkflowPostable,
  WorkflowPostable
]) {
  if (!postA || !postB) {
    return false;
  }

  let timeA = postA!.timestamp?.getTime();
  let timeB = postB!.timestamp?.getTime();
  let authorA = postA.author.name;
  let authorB = postB.author.name;

  return timeA === timeB && authorA === authorB;
}

export default helper(postableMetaIdentical);
