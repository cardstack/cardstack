const Error = require('@cardstack/plugin-utils/error');
const qs = require('qs');
const { merge } = require('lodash');
const koaJSONBody = require('koa-json-body');
const log = require('@cardstack/logger')('cardstack/jsonapi');
const { declareInjections } = require('@cardstack/di');
const { URL } = require('url');
const { withJsonErrorHandling } = Error;

module.exports = declareInjections({
  searcher: 'hub:searchers',
  writers: 'hub:writers',
  indexers: 'hub:indexers',
  controllingBranch: 'hub:controlling-branch',
}, {
  create({ searcher, writers, indexers, controllingBranch }) {
    return {
      category: 'api',
      after: 'authentication',
      middleware() {
        return jsonapiMiddleware(searcher, writers, indexers, controllingBranch.name);
      }
    };
  }
});

function jsonapiMiddleware(searcher, writers, indexers, defaultBranch) {
  // TODO move into config
  let options = {
    defaultBranch,
    prefix: 'api'
  };

  let prefixPattern;
  if (options.prefix) {
    prefixPattern = new RegExp(`^/${options.prefix}/?(.*)`);
  }
  let body = koaJSONBody({ limit: '16mb' });

  return async (ctxt, next) => {
    if (prefixPattern) {
      let m = prefixPattern.exec(ctxt.request.path);
      if (m) {
        ctxt.request.path = '/'+m[1];
      } else {
        return next();
      }
    }

    ctxt.response.set('Access-Control-Allow-Origin', '*');
    if (ctxt.request.method === 'OPTIONS') {
      ctxt.response.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
      ctxt.response.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, If-Match, X-Requested-With');
      ctxt.status = 200;
      return;
    }

    // This is here in case an earlier middleware needs to parse the
    // body before us. That's OK as long as they also set this flag to
    // warn us.
    //
    // TODO: a better solution would be to split the body parsing step
    // out as a separate stage in our middleware stack, so that this
    // plugin (and others) can just list themselves as { after: 'body-parsing' }
    if (!ctxt.state.bodyAlreadyParsed) {
      await body(ctxt, err => {
        if (err) {
          throw err;
        }
      });
    }
    let handler = new Handler(searcher, writers, indexers, ctxt, options);
    return handler.run();
  };
}

class Handler {
  constructor(searcher, writers, indexers, ctxt, options) {
    this.searcher = searcher;
    this.writers = writers;
    this.indexers = indexers;
    this.ctxt = ctxt;
    this.query = qs.parse(this.ctxt.request.querystring, { plainObjects: true });
    this.branch = this.query.branch || options.defaultBranch;
    this.prefix = options.prefix || '';
  }

  get session() {
    return this.ctxt.state.cardstackSession;
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

    if (filter.type === 'all') {
      // this allows for a user to query all document types at once using the
      // endpoint name 'all'
      delete filter.type;
    }

    if (id != null) {
      filter.id = id;
    }
    return filter;
  }

  async run() {
    this.ctxt.response.set('Content-Type', 'application/vnd.api+json');
    await withJsonErrorHandling(this.ctxt, async () => {
      let segments = this.ctxt.request.path.split('/').map(decodeURIComponent);
      let kind;

      if (segments.length == 2) {
        kind = 'Collection';
      } else if (segments.length === 3) {
        kind = 'Individual';
      }
      let methodName = `handle${kind}${this.ctxt.request.method}`;
      log.debug("attempting to match method %s", methodName);
      let method = this[methodName];
      if (method) {
        let rest = segments.slice(1);


        if(rest[0].length === 0) {
          // no type given - will default to 'all'
          rest[0] = 'all';
        }

        await method.apply(this, rest);
      }
    });
  }

  async handleIndividualGET(type, id) {
    let include = (this.query.include || '').split(',');
    let body = await this.searcher.get(this.session, this.branch, type, id, include);
    if (this.query.include === '') {
      delete body.included;
    }
    this.ctxt.body = body;
  }

  async handleIndividualPATCH(type, id) {
    let data = this._mandatoryBodyData();
    let record = await this.writers.update(this.branch, this.session, type, id, data);
    this.ctxt.body = record;
    this.ctxt.status = 200;
  }

  async handleIndividualDELETE(type, id) {
    try {
      let version = this.ctxt.header['if-match'];
      await this.writers.delete(this.branch, this.session, version, type, id);
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
    let { data: models, meta: { page }, included } = await this.searcher.search(this.session, this.branch, {
      filter: this.filterExpression(type),
      sort: this.query.sort,
      page: this.query.page,
      include: this.query.include,
      queryString: this.query.q
    });
    let body = { data: models, meta: { total: page.total } };
    if (page.cursor) {
      body.links = {
        next: this._urlWithUpdatedParams({ page: { cursor: page.cursor } })
      };
    }
    this.ctxt.body = body;
    if (this.query.include !== '' && included && included.length > 0) {
      body.included = included;
    }
  }

  async handleCollectionPOST(type) {
    let data = this._mandatoryBodyData();
    let record = await this.writers.create(this.branch, this.session, type, data);
    this.ctxt.body = record;
    this.ctxt.status = 201;
    let origin = this.ctxt.request.origin;
    if (this.prefix) {
      origin += '/' + this.prefix;
    }
    this.ctxt.set('location', origin + this.ctxt.request.path + '/' + record.data.id);
  }

  _mandatoryBodyData() {
    let data;
    if (!this.ctxt.request.body || !(data = this.ctxt.request.body.data)) {
      throw new Error('A body with a top-level "data" property is required', {
        status: 400
      });
    }
    return { data };
  }

  _urlWithUpdatedParams(params) {
    let p = merge({}, this.query, params);
    let origin = this.ctxt.request.origin;
    if (this.prefix) {
      origin = origin + '/' + this.prefix;
    }
    let u = new URL(origin + (this.ctxt.req.originalUrl || this.ctxt.req.url));
    u.search = "?" + qs.stringify(p, { encode: false });
    return u.href;
  }
}
