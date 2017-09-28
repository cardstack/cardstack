import workflowService from '@cardstack/workflow/services/cardstack-workflow';

export default workflowService.extend({
  // Song Change Requests actions
  approveSongChangeRequest(request) {
    this.process(request.get('message'));
    request.set('status', 'approved');
  },

  denySongChangeRequest(request) {
    this.process(request.get('message'));
    request.set('status', 'denied');
  },

  // Song License Request actions
  approveSongLicenseRequest(request) {
    this.process(request.get('message'));
    request.set('status', 'approved');
  },

  denySongLicenseRequest(request) {
    this.process(request.get('message'));
    request.set('status', 'denied');
  },

  // Chat Message actions
  readChatMessage(chatMessage) {
    this.process(chatMessage.get('message'));
    chatMessage.set('status', 'read');
  }
});
