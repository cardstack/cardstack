import Ember from 'ember';
import Message from '@cardstack/models/generated/message';
// import { workflowGroupId } from '@cardstack/workflow/helpers/workflow-group-id';

import { task } from 'ember-concurrency';
import { computed } from "@ember/object"

export default Message.extend({
  /*
  groupId: Ember.computed('priority.id', 'tag', function() {
    return workflowGroupId([this.get('priority.id'), this.get('tag')]);
  }),

  isHandled: Ember.computed('status', function() {
    return this.get('status') !== 'pending';
  }),

  isImportant: Ember.computed('status', 'priority', function() {
    let status = this.get('status');
    let priority = this.get('priority');
    if (status === 'pending') {
      return [NEED_RESPONSE, DELEGATED].includes(priority);
    } else {
      return [PROCESSED, FYI].includes(priority);
    }
  })
  */
})
