/*
  Writers and Searchers should throw errors of this class in order for
  the server to generate friendly, JSONAPI error responses.

  The arguments to this class are defined via
  http://jsonapi.org/format/#error-objects

*/

class E extends Error {
  constructor(detail, { status, title, source} = {}) {
    super(detail);
    this.detail = detail;
    this.status = status;
    this.title = title;
    this.source = source;
  }
}
module.exports = E;
