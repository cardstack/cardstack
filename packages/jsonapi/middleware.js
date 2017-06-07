const Error = require('@cardstack/plugin-utils/error');
const qs = require('qs');
const { merge } = require('lodash');
const koaJSONBody = require('koa-json-body');
const logger = require('@cardstack/plugin-utils/logger');
const { declareInjections } = require('@cardstack/di');

module.exports = declareInjections({
  searcher: 'hub:searchers',
  writers: 'hub:writers'
}, {
  create({ searcher, writers }) {
    return {
      after: 'authentication',
      middleware() {
        return jsonapiMiddleware(searcher, writers);
      }
    };
  }
});

function jsonapiMiddleware(searcher, writers) {
  // TODO move into config
  let options = {
    defaultBranch: 'master'
  };

  let body = koaJSONBody({ limit: '1mb' });
  let log = logger('jsonapi');

  return async (ctxt) => {
    ctxt.response.set('Access-Control-Allow-Origin', '*');
    if (ctxt.request.method === 'OPTIONS') {
      ctxt.response.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
      ctxt.response.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, If-Match');
      ctxt.status = 200;
      return;
    }

    await body(ctxt, err => {
      if (err) {
        throw err;
      }
    });
    let handler = new Handler(searcher, writers, ctxt, options.defaultBranch, log);
    return handler.run();
  };
}

class Handler {
  constructor(searcher, writers, ctxt, defaultBranch, log) {
    this.searcher = searcher;
    this.writers = writers;
    this.ctxt = ctxt;
    this.query = qs.parse(this.ctxt.request.querystring, { plainObjects: true });
    this.branch = this.query.branch || defaultBranch;
    this.log = log;
  }

  async loadUser() {
    let session = this.ctxt.state.cardstackSession;
    if (session) {
      return session.loadUser();
    }
  }

  filterExpression(type, id) {
    let filter = this.query.filter;
    if (!filter) {
      filter = {};
    }
    if (type != null) {
      // This overwrites any additional type filter the user tried to
      // provide in their query, which is reasonable (the endpoint
      // name itself is taking precedence).
      filter.type = type;
    }
    if (id != null) {
      filter.id = id;
    }
    return filter;
  }

  async run() {
    this.ctxt.response.set('Content-Type', 'application/vnd.api+json');
    try {
      let segments = this.ctxt.request.path.split('/');
      let kind;
      if (segments.length == 2) {
        kind = 'Collection';
      } else if (segments.length === 3) {
        kind = 'Individual';
      }
      let methodName = `handle${kind}${this.ctxt.request.method}`;
      this.log.debug("attempting to match method %s", methodName);
      let method = this[methodName];
      if (method) {
        await method.apply(this, segments.slice(1));
      }
    } catch (err) {
      if (!err.isCardstackError) {
        this.log.debug("passing error onward %s", err);
        throw err;
      }
      let errors = [err];
      if (err.additionalErrors) {
        errors = errors.concat(err.additionalErrors);
      }
      this.ctxt.body = { errors };
      this.ctxt.status = errors[0].status;
    }
  }

  async handleIndividualGET(type, id) {
    let data = await this._lookupRecord(type, id);
    this.ctxt.body = { data };
  }

  async handleIndividualPATCH(type, id) {
    let data = this._mandatoryBodyData();
    let user = await this.loadUser();
    let record = await this.writers.update(this.branch, user, type, id, data);
    this.ctxt.body = { data: record };
    this.ctxt.status = 200;
  }

  async handleIndividualDELETE(type, id) {
    try {
      let version = this.ctxt.header['if-match'];
      let user = await this.loadUser();
      await this.writers.delete(this.branch, user, version, type, id);
      this.ctxt.status = 204;
    } catch (err) {
      // By convention, the writer always refers to the version as
      // /data/meta/version, since that's where it would come from in
      // a PATCH or POST. But in a DELETE it comes from a header, so
      // we adjust any error message.
      if (err.source && err.source.pointer === '/data/meta/version') {
        err.source = { header: 'If-Match' };
      }
      throw err;
    }
  }

  async handleCollectionGET(type) {
    let { models, page } = await this.searcher.search(this.branch, {
      filter: this.filterExpression(type),
      sort: this.query.sort,
      page: this.query.page,
      queryString: this.query.q
    });
    let body = { data: models, meta: { total: page.total } };
    if (page.cursor) {
      body.links = {
        next: this._urlWithUpdatedParams({ page: { cursor: page.cursor } })
      };
    }
    this.ctxt.body = body;
  }

  async handleCollectionPOST(type) {
    let data = this._mandatoryBodyData();
    let user = await this.loadUser();
    let record = await this.writers.create(this.branch, user, type, data);
    this.ctxt.body = { data: record };
    this.ctxt.status = 201;
    this.ctxt.set('location', this.ctxt.request.path + '/' + record.id);
  }

  async _lookupRecord(type, id) {
    let record = await this.searcher.get(this.branch, type, id);
    return record;
  }

  _mandatoryBodyData() {
    let data;
    if (!this.ctxt.request.body || !(data = this.ctxt.request.body.data)) {
      throw new Error('A body with a top-level "data" property is required', {
        status: 400
      });
    }
    return data;
  }

  _urlWithUpdatedParams(params) {
    let p = merge({}, this.query, params);
    return this.ctxt.request.path + "?" + qs.stringify(p, { encode: false });
  }
}
