const { URL } = require('url');
const Handlebars = require('handlebars');
const { declareInjections } = require('@cardstack/di');

const DEFAULT_SOCKET_IO_PORT = 3100;
const DEFAULT_SOCKET_IO_PATH = '/';

const template = Handlebars.compile(`
  {{#each properties as |property|}}
    export const {{property.name}} = "{{property.value}}";
  {{/each}}
`);

module.exports = declareInjections({
  plugins: 'hub:plugins',
  publicURL: 'config:public-url'
},

class LiveQueryCodeGenerator {
  async generateModules() {
    let configured = await this.plugins.active();
    let pluginConfig = configured.describe('@cardstack/live-queries');

    let port = pluginConfig.attributes['socket-port'] || DEFAULT_SOCKET_IO_PORT;
    let socketPath = pluginConfig.attributes['socket-path'] || DEFAULT_SOCKET_IO_PATH;
    let socketIoUrl = new URL(this.publicURL.url);

    socketIoUrl.port = port;
    socketIoUrl.pathname = '';

    return new Map([['environment', 
      template({ 
        properties: [
          {
            name: 'host',
            value: socketIoUrl.toString()
          },
          {
            name: 'path',
            value: socketPath
          }
        ]
      })
    ]]);
  }
}
);
