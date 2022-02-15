import { helper } from '@ember/component/helper';
import { WorkflowPostable } from '../models/workflow';

// one minute
const maxIntervalInMilliseconds = 1000 * 60;

export function postableMetaIdentical([postA, postB]: [
  WorkflowPostable,
  WorkflowPostable
]) {
  if (!postA || !postB) {
    return false;
  }

  let timeA = postA!.timestamp!.getTime();
  let timeB = postB!.timestamp!.getTime();
  let authorA = postA.author.name;
  let authorB = postB.author.name;

  return (
    Math.abs(timeB - timeA) < maxIntervalInMilliseconds && authorA === authorB
  );
}

export default helper(postableMetaIdentical);
