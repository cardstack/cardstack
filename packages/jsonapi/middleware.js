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
      if (!err.isCardstackError) { throw err; }
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
    let data = await this._lookupRecord(type, id);
    this.ctxt.body = { data };
  }

  async handleIndividualPATCH(type, id) {
    let writer = this._writerForType(type);
    let data = this._mandatoryBodyData();
    let record = await writer.update(this.branch, this.user, type, id, data);
    this.ctxt.body = { data: record };
    this.ctxt.status = 200;
  }

  async handleIndividualDELETE(type, id) {
    let writer = this._writerForType(type);
    try {
      let version = this.ctxt.header['if-match'];
      await writer.delete(this.branch, this.user, version, type, id);
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
    let writer = this._writerForType(type);
    let data = this._mandatoryBodyData();
    let record = await writer.create(this.branch, this.user, type, data);
    this.ctxt.body = { data: record };
    this.ctxt.status = 201;
    this.ctxt.set('location', this.ctxt.request.path + '/' + record.id);
  }

  async _lookupRecord(type, id) {
    try {
      let record = await this.searcher.get(this.branch, type, id);
      return record;
    } catch (err) {
      if (err.status === 404 && !err.isCardstackError) {
        // Turn elasticsearch 404 into our nicely formatted 404
        throw new Error(`No such resource ${this.ctxt.request.url}`, {
          status: 404,
          title: 'No such resource'
        });
      }
      throw err;
    }
  }

  _writerForType(type) {
    let contentType = this.schema.types.get(type);
    let writer;
    if (!contentType || !contentType.dataSource || !(writer = contentType.dataSource.writer)) {
      throw new Error(`"${type}" is not a writable type`, {
        status: 403,
        title: "Unsupported type"
      });
    }
    return writer;
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

  urlWithUpdatedParams(params) {
    let p = merge({}, this.query, params);
    return this.ctxt.request.path + "?" + qs.stringify(p, { encode: false });
  }
}
