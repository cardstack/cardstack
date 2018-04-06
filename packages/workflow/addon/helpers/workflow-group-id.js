import { helper as buildHelper } from '@ember/component/helper';

export function workflowGroupId(params) {
  let [priority, tag] = params;
  return `${priority}::${tag}`;
}

export default buildHelper(workflowGroupId);
