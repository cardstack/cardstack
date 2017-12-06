const Handlebars = require('handlebars');
const { declareInjections } = require('@cardstack/di');

const messengerName = 'socket-notification';
const DEFAULT_SOCKET_IO_URL = 'http://localhost:3100';
const template = Handlebars.compile(`
define("@cardstack/cardstack-notifier/environment", ["exports"], function (exports) {
  "use strict";
  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  {{#each properties as |property|}}
    exports.{{property.name}} = "{{property.value}}";
  {{/each}}
});
`);

module.exports = declareInjections({
  messengers: 'hub:messengers'
},

class NotificationCodeGenerator {

  async generateCode() {
    let { socketIoUrl } = await this.messengers.getMessenger(messengerName);
    socketIoUrl = socketIoUrl || DEFAULT_SOCKET_IO_URL;
    return template({ properties: Object.entries({ socketIoUrl }).map(([name, value]) => ({ name, value })) });
  }
});
