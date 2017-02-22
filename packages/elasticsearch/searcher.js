const makeClient = require('@cardstack/data-source/elastic-client');
const logger = require('heimdalljs-logger');

class Searcher {
  constructor() {
    this.es = makeClient();
    this.log = logger('searcher');
  }

  async search(branch, { queryString, filter }) {
    let esBody = {
      query: {
        bool: {
          must: [],
          // All searches exclude `meta` documents, because those are
          // internal to our system.
          must_not: [{
            term: {
              _type: 'meta'
            }
          }]
        }
      }
    };
    if (queryString) {
      esBody.query.bool.must.push({
        match: {
          _all: queryString
        }
      });
    }
    if (filter) {
      for (let expression of this._filterToES(filter)) {
        esBody.query.bool.must.push(expression);
      }
    }
    this.log.debug('search %j', esBody);
    let result = await this.es.search({
      index: branch,
      body: esBody
    });
    this.log.debug('searchResult %j', result);
    return result.hits.hits.map(entry => ({ type: entry._type, id: entry._id, document: entry._source}));
  }

  _filterToES(filter) {
    let result = [];
    Object.keys(filter).forEach(key => {
      let value = filter[key];
      switch(key) {
      case 'not':
        result.push({ bool: { must_not: this._filterToES(value) } });
        break;
      case 'or':
        result.push({ bool: { should: this._filterToES(value) } });
        break;
      case 'and':
        // 'and' is not strictly needed, since we already conjoin all
        // top-level conditions. But for completeness, it works.
        result.push({ bool: { must: this._filterToES(value) } });
        break;
      default:
        // Any keys that aren't one of the predefined operations are
        // field names.
        result.push(this._fieldFilter(key, value));
      }
    });
    return result;
  }

  _fieldFilter(key, value) {
    let field = fieldNameFromKey(key);

    if (typeof value === 'string') {
      // Bare strings are shorthand for a single term filter
      return { term: { [field] : value.toLowerCase() } };
    }

    if (Array.isArray(value)) {
      // Bare arrays are shorthand for a multi term filter
      return { terms: { [field] : value.map(elt => elt.toLowerCase()) } };
    }

    if (value.range) {
      let limits = {};
      ['lte', 'gte', 'lt', 'gt'].forEach(limit => {
        if (value.range[limit]) {
          limits[limit] = value.range[limit];
        }
      });
      return {
        range: {
          [field]: limits
        }
      };
    }

    if (value.exists != null) {
      if (String(value.exists) === 'false') {
        return {
          bool: { must_not: { exists: { field } } }
        };
      } else {
        return {
          exists: { field }
        };
      }
    }

    throw new Error("Unimplemented");
  }
}

// We use elastic search's built-in _type and _id to store JSONAPI's
// type and id. We don't want clients to need to add the underscores.
function fieldNameFromKey(key) {
  if (key === 'type') {
    return '_type';
  }
  if (key === 'id') {
    return '_id';
  }
  return key;
}

module.exports = Searcher;
