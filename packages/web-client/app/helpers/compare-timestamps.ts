import { helper } from '@ember/component/helper';
import { WorkflowMessage } from '../utils/workflow';

function compareTimestamps([posts, i]: [WorkflowMessage[], number]) {
  if (!posts || !posts.length || i === 0) {
    return false;
  }

  let t1 = posts[i]?.timestamp?.getTime();
  let t2 = posts[i - 1]?.timestamp?.getTime();

  return t1 === t2;
}

export default helper(compareTimestamps);
