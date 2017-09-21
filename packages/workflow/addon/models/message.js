import Ember from 'ember';
import Message from '@cardstack/models/generated/message';
import { workflowGroupId } from '@cardstack/workflow/helpers/workflow-group-id';

// Priorities (fixed, provided by the Cardstack framework)
export const DELEGATED = 'Delegated';
export const NEED_RESPONSE = 'Need Response';
export const PROCESSED = 'Processed';
export const FYI = 'For Your Information';

// Tags: that should be "dynamic", supplied by the user
// or extracted from the messages themselves
export const REQUEST_TO_PUBLISH_LIVE = 'Request to publish live';
export const LICENSE_REQUEST = 'License Request';
export const READY_FOR_COPYEDITING = 'Ready for copyediting';
export const COURSE_INFORMATION_SYNCED = 'Course information synced';


export default Message.extend({
  groupId: Ember.computed('priority', 'tag', function() {
    return workflowGroupId([this.get('priority'), this.get('tag')]);
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
})
