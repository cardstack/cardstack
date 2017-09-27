const Error = require('@cardstack/plugin-utils/error');
const qs = require('qs');
const { merge, flatten } = require('lodash');
const koaJSONBody = require('koa-json-body');
const logger = require('@cardstack/plugin-utils/logger');
const { declareInjections } = require('@cardstack/di');
const { URL } = require('url');

module.exports = declareInjections({
  searcher: 'hub:searchers',
  writers: 'hub:writers',
  indexers: 'hub:indexers'
}, {
  create({ searcher, writers, indexers }) {
    return {
      after: 'authentication',
      middleware() {
        return jsonapiMiddleware(searcher, writers, indexers);
      }
    };
  }
});

function jsonapiMiddleware(searcher, writers, indexers) {
  // TODO move into config
  let options = {
    defaultBranch: 'master',
    prefix: 'api'
  };

  let prefixPattern;
  if (options.prefix) {
    prefixPattern = new RegExp(`^/${options.prefix}(.*)`);
  }
  let body = koaJSONBody({ limit: '1mb' });
  let log = logger('jsonapi');

  return async (ctxt, next) => {
    if (prefixPattern) {
      let m = prefixPattern.exec(ctxt.request.path);
      if (m) {
        ctxt.request.path = m[1];
      } else {
        return next();
      }
    }

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
    let handler = new Handler(searcher, writers, indexers, ctxt, options, log);
    return handler.run();
  };
}

class Handler {
  constructor(searcher, writers, indexers, ctxt, options, log) {
    this.searcher = searcher;
    this.writers = writers;
    this.indexers = indexers;
    this.ctxt = ctxt;
    this.query = qs.parse(this.ctxt.request.querystring, { plainObjects: true });
    this.branch = this.query.branch || options.defaultBranch;
    this.prefix = options.prefix || '';
    this.log = log;
    this._includes = null;
    this.includedSets = null;
    this.includedResources = null;
  }

  get session() {
    return this.ctxt.state.cardstackSession;
  }

  get includes() {
    if (!this._includes) {
      if (this.query.include) {
        this._includes = this.query.include.split(',').map(part => part.split('.'));
      } else {
        this._includes = [];
      }
    }
    return this._includes;
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
      let segments = this.ctxt.request.path.split('/').map(decodeURIComponent);
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
    let body = await this._lookupRecord(type, id);
    this.ctxt.body = body;
    if (this.includes.length === 0) {
      return;
    }
    await this._loadAllIncluded([body.data]);
  }

  async handleIndividualPATCH(type, id) {
    let data = this._mandatoryBodyData();
    let record = await this.writers.update(this.branch, this.session, type, id, data);
    this.ctxt.body = { data: record };
    this.ctxt.status = 200;
    if (this.query.nowait == null) {
      await this.indexers.update({ realTime: true, hints: [{ branch: this.branch, id, type }] });
    }
  }

  async handleIndividualDELETE(type, id) {
    try {
      let version = this.ctxt.header['if-match'];
      await this.writers.delete(this.branch, this.session, version, type, id);
      this.ctxt.status = 204;
      if (this.query.nowait == null) {
        await this.indexers.update({ realTime: true, hints: [{ branch: this.branch, id, type }] });
      }
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
    let { data: models, meta: { page } } = await this.searcher.search(this.branch, {
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
    await this._loadAllIncluded(models);
  }

  async handleCollectionPOST(type) {
    let data = this._mandatoryBodyData();
    let record = await this.writers.create(this.branch, this.session, type, data);
    this.ctxt.body = { data: record };
    this.ctxt.status = 201;
    let origin = this.ctxt.request.origin;
    if (this.prefix) {
      origin += '/' + this.prefix;
    }
    this.ctxt.set('location', origin + this.ctxt.request.path + '/' + record.id);
    if (this.query.nowait == null) {
      await this.indexers.update({ realTime: true, hints: [{ branch: this.branch, id: record.id, type }] });
    }
  }

  async _lookupRecord(type, id) {
    if (this.includedResources) {
      let record = this.includedResources[`${type}/${id}`];
      if (record) {
        return record;
      }
    }
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
    let origin = this.ctxt.request.origin;
    if (this.prefix) {
      origin = origin + '/' + this.prefix;
    }
    let u = new URL(origin + (this.ctxt.req.originalUrl || this.ctxt.req.url));
    u.search = "?" + qs.stringify(p, { encode: false });
    return u.href;
  }

  async _loadAllIncluded(root) {
    // this is a map from each requested include path to a promise
    // that resolves with the list of resources in that set
    this.includedSets = Object.create(null);

    // this is a map from type/id strings to each of the resources we
    // have already loaded
    this.includedResources = Object.create(null);

    // some included models may have already come along with the
    // document we got out of the searcher
    if (this.ctxt.body.included) {
      for (let resource of this.ctxt.body.included) {
        this.includedResources[`${resource.type}/${resource.id}`] = resource;
      }
    }

    this.includes.forEach(segments => this._loadIncluded(root, segments));
    await Promise.all(Object.values(this.includedSets));
    this.ctxt.body.included = Object.keys(this.includedResources).map(k => this.includedResources[k].data);
  }

  async _loadIncluded(root, segments) {
    let name = segments.join('.');
    if (this.includedSets[name]) {
      return this.includedSets[name];
    }

    return this.includedSets[name] = (async () => {
      let tail = segments[segments.length - 1];
      let sourceSet;
      if (segments.length === 1) {
        sourceSet = root;
      } else {
        sourceSet = await this._loadIncluded(root, segments.slice(0, -1));
      }
      let resources = flatten(await Promise.all(sourceSet.map(record => {
        if (!record.relationships || !record.relationships[tail]) {
          return [];
        }
        let data = record.relationships[tail].data;
        if (Array.isArray(data)) {
          return Promise.all(data.map(ref => this._lookupRecord(ref.type, ref.id)));
        } else if (data) {
          return this._lookupRecord(data.type, data.id).then(record => [record]);
        } else {
          return [];
        }
      })));
      for (let resource of resources) {
        this.includedResources[`${resource.data.type}/${resource.data.id}`] = resource;
        if (resource.included) {
          for (let inner of resource.included) {
            this.includedResources[`${inner.data.type}/${inner.data.id}`] = { data: inner };
          }
        }
      }
      return resources.map(r => r.data);
    })();
  }
}
