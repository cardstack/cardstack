import workflowService from '@cardstack/workflow/services/cardstack-workflow';

export default workflowService.extend({
  // Song Change Requests actions
  approveSongChangeRequest(changeRequest) {
    // 1. Process the message in the general
    this.process(changeRequest.get('message'));
    // 2. Approve the SCR in the domain-specific
    changeRequest.set('status', 'approved');
  },

  denySongChangeRequest(changeRequest) {
    // 1. Process the message in the general
    this.process(changeRequest.get('message'));
    // 2. Approve the SCR in the domain-specific
    changeRequest.set('status', 'denied');
  },

  // Chat Message actions
  readChatMessage(chatMessage) {
    this.process(chatMessage.get('message'));
    chatMessage.set('status', 'read');
  }
});
