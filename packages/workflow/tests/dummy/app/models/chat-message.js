import ChatMessage from '@cardstack/models/generated/chat-message';
import hasMessage from '@cardstack/workflow/utils/has-message';

export default ChatMessage.extend({
  message: hasMessage('chat-messages'),

  read() {
    this.set('status', 'read');
  },
});
