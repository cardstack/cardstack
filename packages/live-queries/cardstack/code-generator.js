const Handlebars = require('handlebars');
const { declareInjections } = require('@cardstack/di');

const DEFAULT_SOCKET_IO_PORT = 3100;
const DEFAULT_SOCKET_IO_PATH = '/';

const template = Handlebars.compile(`
define("@cardstack/live-queries/environment", ["exports"], function (exports) {
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
  plugins: 'hub:plugins'
},

class LiveQueryCodeGenerator {

  async generateCode() {
    let configured = await this.plugins.active();
    let pluginConfig = configured.describe('@cardstack/live-queries');


    let protocol = 'http';
    let hostname = 'localhost';
    let port = pluginConfig.attributes['socket-port'] || DEFAULT_SOCKET_IO_PORT;
    let socket_host = `${protocol}://${hostname}:${port}`;

    let socket_path = pluginConfig.attributes['socket-path'] || DEFAULT_SOCKET_IO_PATH;

    return template({ properties: [
      {
        name: 'host',
        value: socket_host
      },
      {
        name: 'path',
        value: socket_path
      }
    ]});
  }
});
