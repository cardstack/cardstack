const Error = require('@cardstack/data-source/error');
const qs = require('qs');
const { merge } = require('lodash');

module.exports = function(searcher, optionsArg) {
  let options = Object.assign({}, {
    defaultBranch: 'master'
  }, optionsArg);

  return async (ctxt) => {
    let handler = new Handler(searcher, ctxt, options);
    return handler.run();
  };
};

class Handler {
  constructor(searcher, ctxt, options) {
    this.searcher = searcher;
    this.ctxt = ctxt;
    this.options = options;
    this._query = null;
  }

  get query() {
    if (!this._query) {
      this._query = qs.parse(this.ctxt.request.querystring, { plainObjects: true });
    }
    return this._query;
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

  urlWithUpdatedParams(params) {
    let p = merge({}, this.query, params);
    return this.ctxt.request.path + "?" + qs.stringify(p, { encode: false });
  }
}
