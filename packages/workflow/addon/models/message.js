import Ember from 'ember';
import Message from '@cardstack/models/generated/message';

export default Message.extend({
  isHandled: Ember.computed('status', function() {
    return this.get('status') !== 'pending';
  })
})
