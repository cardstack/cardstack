const compose = require('koa-compose');
const route = require('koa-better-route');
const koaJSONBody = require('koa-json-body');
const qs = require('qs');
const { declareInjections } = require('@cardstack/di');

const defaultBranch = 'master';

module.exports = declareInjections({
  writers: 'hub:writers',
},

class TestSupportMiddleware {
  middleware() {
    const prefix = 'test-support';

    return compose([
      this._createCheckpoint(prefix),
      this._restoreCheckpoint(prefix),
    ]);
  }

  _createCheckpoint(prefix) {
    return route.post(`/${prefix}/checkpoints`, async (ctxt/*, next*/) => {
      let query = qs.parse(ctxt.request.querystring, { plainObjects: true });
      let branch = query.branch || defaultBranch;
      let document = await mandatoryBodyData(ctxt);
      let { type } = document;

      let checkpoint = await this.writers.createCheckpoint(branch, ctxt.state.cardstackSession, type, document);

      ctxt.status = 201;
      ctxt.body = { data: checkpoint };
    });
  }

  _restoreCheckpoint(prefix) {
    return route.post(`/${prefix}/restores`, async (ctxt/*, next*/) => {
      let query = qs.parse(ctxt.request.querystring, { plainObjects: true });
      let branch = query.branch || defaultBranch;
      let document = await mandatoryBodyData(ctxt);
      let { type } = document;

      let restore = await this.writers.restoreCheckpoint(branch, ctxt.state.cardstackSession, type, document);

      ctxt.status = 201;
      ctxt.body = { data: restore };
    });
  }
});

async function parseBody(ctxt) {
  // This is here in case an earlier middleware needs to parse the
  // body before us. That's OK as long as they also set this flag to
  // warn us.
  //
  // TODO: a better solution would be to split the body parsing step
  // out as a separate stage in our middleware stack, so that this
  // plugin (and others) can just list themselves as { after: 'body-parsing' }
  let _body = koaJSONBody({ limit: '1mb' });
  if (!ctxt.state.bodyAlreadyParsed) {
    await _body(ctxt, err => {
      if (err) {
        throw err;
      }
    });
  }
}

async function mandatoryBodyData(ctxt) {
  await parseBody(ctxt);

  let data;
  if (!ctxt.request.body || !(data = ctxt.request.body.data)) {
    throw new Error('A body with a top-level "data" property is required', {
      status: 400
    });
  }
  return data;
}
