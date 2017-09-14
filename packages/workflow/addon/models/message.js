import Ember from 'ember';
import Message from '@cardstack/models/generated/message';
import { workflowGroupId } from '@cardstack/workflow/helpers/workflow-group-id';

export default Message.extend({
  groupId: Ember.computed('priority', 'tag', function() {
    return workflowGroupId([this.get('priority'), this.get('tag')]);
  }),

  isHandled: Ember.computed('status', function() {
    return this.get('status') !== 'pending';
  })
})
