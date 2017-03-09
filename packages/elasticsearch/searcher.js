const makeClient = require('@cardstack/elasticsearch/client');
const logger = require('heimdalljs-logger');
const Error = require('@cardstack/data-source/error');

class Searcher {
  constructor(schemaCache) {
    this.es = makeClient();
    this.log = logger('searcher');
    this.schemaCache = schemaCache;
  }

  async search(branch, { queryString, filter, sort }) {
    let schema = await this.schemaCache.schemaForBranch(branch);
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
      },
      sort: this._buildSorts(schema, sort)
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
    return result.hits.hits.map(entry => {
      let relnames = entry._source.cardstack_rel_names;
      let attributes = {};
      let relationships = {};
      Object.keys(entry._source).forEach(fieldName => {
        if (fieldName === 'cardstack_rel_names') {
          // pass
        } else if (relnames.includes(fieldName)) {
          relationships[fieldName] = entry._source[fieldName];
        } else {
          attributes[fieldName] = entry._source[fieldName];
        }
      });
      return {
        type: entry._type,
        id: entry._id,
        attributes,
        relationships
      };
    });
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

  _buildSorts(schema, sort) {
    let output = [];
    if (sort) {
      if (Array.isArray(sort)) {
        sort.forEach(name => {
          output.push(this._buildSort(schema, name));
        });
      } else {
        output.push(this._buildSort(schema, sort));
      }
    }

    // We always have a backstop sort so we guarantee a total
    // order. This ensures pagination is correct.
    output.push({ '_uid': 'asc' });
    return output;
  }

  _buildSort(schema, name) {
    let realName, order;
    if (name.indexOf('-') === 0) {
      realName = name.slice(1);
      order = 'desc';
    } else {
      realName = name;
      order = 'asc';
    }
    let field = schema.fields.get(realName);
    if (!field) {
      throw new Error(`Cannot sort by unknown field "${realName}"`, {
        status: 400,
        title: "Unknown sort field"
      });
    }
    return {
      [field.sortFieldName] : { order }
    };
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
