import workflowService from '@cardstack/workflow/services/cardstack-workflow';

export default workflowService.extend({
  // Song Change Requests actions
  approveSongChangeRequest(request) {
    this.process(request.get('message'));
    request.approve();
  },

  denySongChangeRequest(request) {
    this.process(request.get('message'));
    request.deny();
  },

  // Song License Request actions
  approveSongLicenseRequest(request) {
    this.process(request.get('message'));
    request.approve();
  },

  denySongLicenseRequest(request) {
    this.process(request.get('message'));
    request.deny();
  },

  // Chat Message actions
  readChatMessage(chatMessage) {
    this.process(chatMessage.get('message'));
    chatMessage.read();
  }
});
