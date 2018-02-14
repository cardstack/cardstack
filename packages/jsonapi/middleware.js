const Error = require('@cardstack/plugin-utils/error');
const qs = require('qs');
const { merge, flatten, uniq, uniqBy } = require('lodash');
const koaJSONBody = require('koa-json-body');
const log = require('@cardstack/logger')('cardstack/jsonapi');
const { declareInjections } = require('@cardstack/di');
const { URL } = require('url');
const defaultIncludes = {};
const { withJsonErrorHandling } = Error;

module.exports = declareInjections({
  searcher: 'hub:searchers',
  writers: 'hub:writers',
  indexers: 'hub:indexers'
}, {
  create({ searcher, writers, indexers }) {
    return {
      category: 'api',
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
    prefixPattern = new RegExp(`^/${options.prefix}/?(.*)`);
  }
  let body = koaJSONBody({ limit: '1mb' });

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
    this._includes = null;
  }

  get session() {
    return this.ctxt.state.cardstackSession;
  }

  get includes() {
    if (!this._includes) {
      if (this.query.include != null) {
        if (this.query.include) {
          this._includes = this.query.include.split(',').map(part => part.split('.'));
        } else {
          this._includes = [];
        }
      } else {
        this._includes = defaultIncludes;
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
        await method.apply(this, segments.slice(1));
      }
    });
  }

  async handleIndividualGET(type, id) {
    let body = await this._lookupRecord(type, id);
    this.ctxt.body = body;
    if (this.includes === defaultIncludes) {
      // leave alone whatever includes were already on the document we
      // got out of the search index.
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
    let { data: models, meta: { page }, included } = await this.searcher.search(this.session, this.branch, {
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
    if (this.includes === defaultIncludes) {
      if (included) {
        // the default includes out of the searcher are not guaranteed
        // to be deduplicated
        body.included = uniqBy(models.concat(included), r => `${r.type}/${r.id}`).slice(models.length);
      }
    } else {
      if (included && included.length > 0) {
        // we don't need to do any deduplication here because
        // loadAllIncluded is going to take over.
        body.included = included;
      }
      await this._loadAllIncluded(models);
    }
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
    let record = await this.searcher.get(this.session, this.branch, type, id);
    return record;
  }

  async _cachedLookupRecord(type, id, cache) {
    let key = `${type}/${id}`;
    {
      let cached = cache[key];
      if (cached) {
        return cached;
      }
    }
    let resource = await this._lookupRecord(type, id);
    if (resource) {
      if (!cache[key]) {
        cache[key] = resource.data;
      }
      if (resource.included) {
        for (let inner of resource.included) {
          let innerKey = `${inner.type}/${inner.id}`;
          if (!cache[innerKey]) {
            cache[innerKey] = inner;
          }
        }
      }
      return cache[key];
    }
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
    let sets = Object.create(null);

    // this is a map from type/id strings to each of the resources we
    // have already loaded.
    let cache = Object.create(null);
    for (let resource of root) {
      cache[`${resource.type}/${resource.id}`] = resource;
    }

    // some included models may have already come along with the
    // document we got out of the searcher
    if (this.ctxt.body.included) {
      for (let resource of this.ctxt.body.included) {
        cache[`${resource.type}/${resource.id}`] = resource;
      }
    }

    this.includes.forEach(segments => this._loadIncluded(root, segments, cache, sets));

    // this uniq works because our cache works as an identity map
    let included = uniq(root.concat(flatten(await Promise.all(Object.values(sets)))));

    if (included.length > root.length) {
      this.ctxt.body.included = included.slice(root.length);
    } else {
      delete this.ctxt.body.included;
    }
  }

  async _loadIncluded(root, segments, cache, sets) {
    let name = segments.join('.');
    if (sets[name]) {
      return sets[name];
    }

    return sets[name] = (async () => {
      let tail = segments[segments.length - 1];
      let sourceSet;
      if (segments.length === 1) {
        sourceSet = root;
      } else {
        sourceSet = await this._loadIncluded(root, segments.slice(0, -1), cache, sets);
      }

      // TODO: we could correlate all the things that need to be
      // fetched at this level into a single query, or at least a
      // single query per type.
      let lists = await Promise.all(sourceSet.map(async record => {
        if (!record.relationships || !record.relationships[tail]) {
          return [];
        }
        let data = record.relationships[tail].data;
        if (Array.isArray(data)) {
          return Promise.all(data.map(ref => this._cachedLookupRecord(ref.type, ref.id, cache)));
        } else if (data) {
          let resource = await this._cachedLookupRecord(data.type, data.id, cache);
          return [resource];
        } else {
          return [];
        }
      }));
      return flatten(lists);
    })();
  }
}
