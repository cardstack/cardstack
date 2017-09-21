import Ember from 'ember';

export function workflowGroupId(params) {
  let [priority, tag] = params;
  return `${priority}::${tag}`;
}

export default Ember.Helper.helper(workflowGroupId);
