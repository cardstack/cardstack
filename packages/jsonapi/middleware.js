const Error = require('@cardstack/data-source/error');
const qs = require('qs');
const { merge } = require('lodash');
const koaJSONBody = require('koa-json-body');

module.exports = function(searcher, schemaCache, optionsArg) {
  let options = Object.assign({}, {
    defaultBranch: 'master'
  }, optionsArg);

  let body = koaJSONBody({ limit: '1mb' });

  return async (ctxt) => {
    await body(ctxt, err => {
      if (err) {
        throw err;
      }
    });
    let branch = options.defaultBranch;
    let schema = await schemaCache.schemaForBranch(branch);
    let handler = new Handler(searcher, ctxt, schema, branch);
    return handler.run();
  };
};

class Handler {
  constructor(searcher, ctxt, schema, branch) {
    this.searcher = searcher;
    this.ctxt = ctxt;
    this.schema = schema;
    this.branch = branch;
    this._query = null;
  }

  get query() {
    if (!this._query) {
      this._query = qs.parse(this.ctxt.request.querystring, { plainObjects: true });
    }
    return this._query;
  }

  get user() {
    return {
      fullName: 'Anonymous Coward',
      email: 'anon@example.com'
    };
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
      let method = this[`handle${kind}${this.ctxt.request.method}`];
      if (method) {
        await method.apply(this, segments.slice(1));
      }
    } catch (err) {
      if (!err.status) { throw err; }
      this.ctxt.status = err.status;
      this.ctxt.body = {
        errors: [
          {
            title: err.title,
            detail: err.detail,
            code: err.status,
            source: err.source
          }
        ]
      };
    }
  }

  async handleIndividualGET(type, id) {
    let { models } = await this.searcher.search(this.branch, {
      filter: { type,  id }
    });
    if (models.length === 0) {
      throw new Error(`No such resource ${this.ctxt.request.url}`, {
        status: 404,
        title: 'No such resource'
      });
    }
    this.ctxt.body = {
      data: models[0]
    };
  }

  async handleCollectionGET(type) {
    let { models, page } = await this.searcher.search(this.branch, {
      filter: this.filterExpression(type),
      sort: this.query.sort,
      page: this.query.page
    });
    let body = { data: models, meta: { total: page.total } };
    if (page.cursor) {
      body.links = {
        next: this.urlWithUpdatedParams({ page: { cursor: page.cursor } })
      };
    }
    this.ctxt.body = body;
  }

  async handleCollectionPOST(type) {
    let contentType = this.schema.types.get(type);
    let writer;
    if (!contentType || !contentType.dataSource || !(writer = contentType.dataSource.writer)) {
      throw new Error(`"${type}" is not a supported type`, {
        status: 403,
        title: "Unsupported type"
      });
    }
    let data;
    if (!this.ctxt.request.body || !(data = this.ctxt.request.body.data)) {
      throw new Error('A body with a top-level "data" property is required', {
        status: 400
      });
    }
    let record = await writer.create(this.branch, this.user, type, data);
    this.ctxt.body = { data: record };
    this.ctxt.status = 201;
    this.ctxt.set('location', this.ctxt.request.path + '/' + record.id);
  }

  urlWithUpdatedParams(params) {
    let p = merge({}, this.query, params);
    return this.ctxt.request.path + "?" + qs.stringify(p, { encode: false });
  }
}
