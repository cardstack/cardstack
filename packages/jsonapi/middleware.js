const Error = require('@cardstack/data-source/error');

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
  }
  async run() {
    this.ctxt.response.set('Content-Type', 'application/vnd.api+json');
    try {
      let segments = this.ctxt.request.url.split('/');
      if (segments.length === 3) {
        await this.handleIndividualResource(segments[1], segments[2]);
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
  async handleIndividualResource(type, id) {
    if (this.ctxt.request.method === 'GET') {
      return this.getIndividualResource(type, id);
    }
  }
  async getIndividualResource(type, id) {
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
}
