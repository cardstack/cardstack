const { declareInjections } = require('@cardstack/di');
const route = require('koa-better-route');
const koaJSONBody = require('koa-json-body');

module.exports = declareInjections({
  messengers: 'hub:messengers'
},

class CodeGenMiddleware {
  constructor() {
    this.before = 'authentication';
  }

  middleware() {
    //TODO: Get these from config
    let messageSinkId = 'the-sink';
    let defaultMailTo = 'contact@cardstack.com';

    let body = koaJSONBody({ limit: '16mb' });

    return route.post('/email/send', body, async (ctxt) => {

      console.log(ctx.request.body)
      
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
