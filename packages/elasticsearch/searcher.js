const Client = require('@cardstack/elasticsearch/client');
const logger = require('heimdalljs-logger');
const Error = require('@cardstack/plugin-utils/error');
const toJSONAPI = require('./to-jsonapi');

class Searcher {
  constructor(schemaCache) {
    this.client = new Client();
    this.log = logger('searcher');
    this.schemaCache = schemaCache;
  }

  async get(branch, type, id) {
    let document = await this.client.es.getSource({
      index: Client.branchToIndexName(branch),
      type,
      id: `${branch}/${id}`
    });
    return toJSONAPI(type, document);
  }

  async search(branch, { queryString, filter, sort, page }) {
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
      sort: await this._buildSorts(branch, schema, sort)
    };

    let size = 10;
    if (page && /^\d+$/.test(page.size)) {
      size = parseInt(page.size, 10);
    }

    // We always overfetch by one record. This allows us to know
    // whether we should offer a next page link.
    esBody.size = size + 1;

    if (page && page.cursor) {
      esBody.search_after = JSON.parse(decodeURIComponent(page.cursor));
    }

    if (queryString) {
      esBody.query.bool.must.push({
        match: {
          _all: queryString
        }
      });
    }
    if (filter) {
      for (let expression of await this._filterToES(branch, schema, filter)) {
        esBody.query.bool.must.push(expression);
      }
    }
    this.log.debug('search %j', esBody);
    try {
      let result = await this.client.es.search({
        index: Client.branchToIndexName(branch),
        body: esBody
      });
      this.log.debug('searchResult %j', result);
      return this._assembleResponse(result, size);
    } catch (err) {
      // elasticsearch errors have their own status codes, and Koa
      // will treat them as valid responses if we let them through. We
      // don't want that -- we want to render proper JSONAPI errors.
      if (err.message && err.body && err.body.error) {
        if (err.message.indexOf('[index_not_found_exception]') === 0) {
          throw new Error(`No such branch '${branch}' in our search index`, {
            status: 404,
            title: "No such branch"
          });
        }
        throw new Error(err.message, {
          status: 500,
          title: 'elasticsearch failure',
        });
      }
      throw err;
    }
  }

  _assembleResponse(result, requestedSize) {
    let documents = result.hits.hits;
    let pagination = {
      total: result.hits.total
    };

    if (documents.length > requestedSize) {
      documents = documents.slice(0, requestedSize);
      let last = documents[documents.length - 1];
      pagination.cursor = encodeURIComponent(JSON.stringify(last.sort));
    }

    let models = documents.map(
      document => toJSONAPI(document._type, document._source)
    );
    return {
      models,
      page: pagination
    };
  }

  async _filterToES(branch, schema, filter) {
    let result = [];
    for (let [key, value] of Object.entries(filter)) {
      switch(key) {
      case 'not':
        result.push({ bool: { must_not: await this._filterToES(branch, schema, value) } });
        break;
      case 'or':
        if (!Array.isArray(value)) {
          throw new Error(`the "or" operator must receive an array of other filters`, { status: 400 });
        }
        result.push({
          bool: {
            should: await Promise.all(value.map(
              async v => ({ bool: { must: await this._filterToES(branch, schema, v) } })
            ))
          }
        });
        break;
      case 'and':
        // 'and' is not strictly needed, since we already conjoin all
        // top-level conditions. But for completeness, it works.
        if (!Array.isArray(value)) {
          throw new Error(`the "and" operator must receive an array of other filters`, { status: 400 });
        }
        for (let v of value) {
          for (let r of await this._filterToES(branch, schema, v)) {
            result.push(r);
          }
        }
        break;
      default:
        // Any keys that aren't one of the predefined operations are
        // field names.
        result.push(await this._fieldFilter(branch, schema, key, value));
      }
    }
    return result;
  }

  async _fieldFilter(branch, schema, key, value) {
    let field = schema.fields.get(key);
    if (!field) {
      throw new Error(`Cannot filter by unknown field "${key}"`, {
        status: 400,
        title: "Unknown field in filter"
      });
    }

    if (typeof value === 'string') {
      // Bare strings are shorthand for a single term filter
      let esName = await this.client.logicalFieldToES(branch, field.queryFieldName);
      return { term: { [esName] : value.toLowerCase() } };
    }

    if (Array.isArray(value)) {
      // Bare arrays are shorthand for a multi term filter
      let esName = await this.client.logicalFieldToES(branch, field.queryFieldName);
      return { terms: { [esName] : value.map(elt => elt.toLowerCase()) } };
    }

    if (value.range) {
      let limits = {};
      ['lte', 'gte', 'lt', 'gt'].forEach(limit => {
        if (value.range[limit]) {
          limits[limit] = value.range[limit];
        }
      });
      let esName = await this.client.logicalFieldToES(branch, field.queryFieldName);            return {
        range: {
          [esName]: limits
        }
      };
    }

    if (value.exists != null) {
      let esName = await this.client.logicalFieldToES(branch, field.queryFieldName);
      if (String(value.exists) === 'false') {
        return {
          bool: { must_not: { exists: { field: esName } } }
        };
      } else {
        return {
          exists: { field: esName }
        };
      }
    }

    if (value.exact != null) {
      let innerQuery = value.exact;
      let esName = await this.client.logicalFieldToES(branch, field.sortFieldName);
      if (typeof innerQuery === 'string') {
        // This is the sortFieldName because that one is designed for
        // exact matching (in addition to sorting).
        return { term: { [esName] : innerQuery.toLowerCase() } };
      }
      if (Array.isArray(innerQuery)) {
        // This is the sortFieldName because that one is designed for
        // exact matching (in addition to sorting).
        return { terms: { [esName] : innerQuery.map(elt => elt.toLowerCase()) } };
      }
    }

    throw new Error(`Unimplemented filter ${key} ${value}`);
  }

  async _buildSorts(branch, schema, sort) {
    let output = [];
    if (sort) {
      if (Array.isArray(sort)) {
        for (let name of sort) {
          output.push(await this._buildSort(branch, schema, name));
        }
      } else {
        output.push(await this._buildSort(branch, schema, sort));
      }
    }

    // We always have a backstop sort so we guarantee a total
    // order. This ensures pagination is correct.
    output.push({ '_uid': 'asc' });
    return output;
  }

  async _buildSort(branch, schema, name) {
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

    let esName = await this.client.logicalFieldToES(branch, field.sortFieldName);

    return {
      [esName] : { order }
    };
  }

}


module.exports = Searcher;
