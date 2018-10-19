const { declareInjections } = require('@cardstack/di');
const Session = require('@cardstack/plugin-utils/session');
const route = require('koa-better-route');
const koaJSONBody = require('koa-json-body');

module.exports = declareInjections({
  messengers: 'hub:messengers',
  searcher: 'hub:searchers'
},

class EmailMiddleware {
  constructor() {
    this.before = 'authentication';
  }

  async _readConfig() {
    try {
      let config = await this.searcher.getFromControllingBranch(Session.INTERNAL_PRIVILEGED, 'plugin-configs', '@cardstack/email');

      if (config && config.data.attributes['plugin-config']) {
        let { messageSinkId, defaultMailTo } = config.data.attributes['plugin-config'];
        return {
          messageSinkId,
          defaultMailTo
        };
      }
    } catch (e) {
      throw '`@cardstack/email` requires the following plugin-config: messageSinkId, defaultMailto'
    }
  }

  middleware() {
    let body = koaJSONBody({ limit: '16mb' });
    
    return route.post('/email/send', async (ctxt) => {
      let { messageSinkId, defaultMailTo } = await this._readConfig();
      if (!ctxt.state.bodyAlreadyParsed) {
        await body(ctxt, err => {
          if (err) {
            throw err;
          }
        });
      }
      
      await this.messengers.send(messageSinkId, {
        to: defaultMailTo,
        subject: 'Hello from cardstack',
        from: 'jorge.lainfiesta@cardstack.com',
        text: 'Hello my friend',
        html: '<h1>Hello my friend</h1>'
      });

      ctxt.body = `console.log('Hello world: ${messageSinkId}')`;
      ctxt.response.set('Access-Control-Allow-Origin', '*');
      ctxt.response.set('Content-Type', 'application/javascript');
      ctxt.status = 200;
    });
  }

});
