const Client = require('./client');
const log = require('@cardstack/logger')('cardstack/searcher');
const authLog = require('@cardstack/logger')('cardstack/auth');
const Error = require('@cardstack/plugin-utils/error');
const toJSONAPI = require('./to-jsonapi');
const { declareInjections } = require('@cardstack/di');

module.exports = declareInjections({
  schema: 'hub:current-schema'
},

class Searcher {
  constructor() {
    this.client = null;
  }

  async _ensureClient() {
    if (!this.client) {
      this.client = await Client.create();
    }
  }

  async get(session, branch, type, id) {
    await this._ensureClient();
    let index = Client.branchToIndexName(branch);
    let esId = `${branch}/${id}`;
    log.debug('get %s %s %s', index, type, esId);
    let document;
    try {
      document = await this.client.es.getSource({ index, type, id: esId });
    } catch (err) {
      if (err.hasOwnProperty('status') && !err.isCardstackError) {
        if (err.status === 404) {
          return;
        }
        throw new Error(err.message, {
          status: err.status
        });
      }
      throw err;
    }

    if (await matchingResourceRealms(document, session)) {
      return toJSONAPI(type, document);
    }
  }

  async search(session, branch, { queryString, filter, sort, page }) {
    let [schema, realms] = await Promise.all([
      this.schema.forBranch(branch),
      session.realms(),
      this._ensureClient()
    ]);

    let esBody = {
      query: {
        bool: {
          must: [{
            terms: {
              // This is our resource-level read security
              cardstack_resource_realms: realms
            }
          }],
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
    log.debug('search %j', esBody);
    try {
      let result = await this.client.es.search({
        index: Client.branchToIndexName(branch),
        body: esBody
      });
      log.debug('searchResult %j', result);
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
    let page = {
      total: result.hits.total
    };

    if (documents.length > requestedSize) {
      documents = documents.slice(0, requestedSize);
      let last = documents[documents.length - 1];
      page.cursor = encodeURIComponent(JSON.stringify(last.sort));
    }

    let included = [];
    let data = documents.map(
      document => {
        let jsonapi = toJSONAPI(document._type, document._source);
        if (jsonapi.included) {
          included = included.concat(jsonapi.included);
        }
        return jsonapi.data;
      }
    );
    return {
      data,
      included,
      meta: { page },
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
        result.push(await this._pathFilter(branch, schema, [], key.split('.'), value));
      }
    }
    return result;
  }

  async _pathFilter(branch, schema, aboveSegments, belowSegments, value) {
    if (belowSegments.length === 1) {
      return this._fieldFilter(branch, schema, aboveSegments, belowSegments[0], value);
    } else {
      let key = belowSegments[0];
      let field = schema.fields.get(key);
      if (!field) {
        throw new Error(`Cannot filter by unknown field "${key}" within "${aboveSegments.join('.')}"`, {
          status: 400,
          title: "Unknown field in filter"
        });
      }
      let here = aboveSegments.concat(field.queryFieldName);

      if (field.fieldType === '@cardstack/core-types::has-many') {
        return {
          nested: {
            path: here.join('.'),
            query: {
              bool: {
                must: await this._pathFilter(branch, schema, here, belowSegments.slice(1), value)
              }
            }
          }
        };
      } else {
        return this._pathFilter(branch, schema, here, belowSegments.slice(1), value);
      }
    }
  }

  async _fieldFilter(branch, schema, aboveSegments, key, value) {
    let field;

    if (['cardstack_source'].includes(key)) {
      // this is an internal field (meaning it's not visible in the
      // jsonapi records themselves) that we make available for
      // filtering. The schema-cache uses this to avoid shadowing seed
      // models, for example.
      field = { queryFieldName: key, sortFieldName: key };
    } else {
      field = schema.fields.get(key);
    }

    if (!field) {
      throw new Error(`Cannot filter by unknown field "${key}"`, {
        status: 400,
        title: "Unknown field in filter"
      });
    }

    if (typeof value === 'string') {
      // Bare strings are shorthand for a match filter
      let esName = await this.client.logicalFieldToES(branch, field.queryFieldName);
      let path = aboveSegments.concat(esName).join('.');
      return { match: { [path] : value } };
    }

    if (Array.isArray(value)) {
      // Bare arrays are shorthand for a multi term filter
      let esName = await this.client.logicalFieldToES(branch, field.queryFieldName);
      let path = aboveSegments.concat(esName).join('.');
      return { terms: { [path] : value.map(elt => elt.toLowerCase()) } };
    }

    if (value.range) {
      let limits = {};
      ['lte', 'gte', 'lt', 'gt'].forEach(limit => {
        if (value.range[limit]) {
          limits[limit] = value.range[limit];
        }
      });
      let esName = await this.client.logicalFieldToES(branch, field.queryFieldName);
      let path = aboveSegments.concat(esName).join('.');
      return {
        range: {
          [path]: limits
        }
      };
    }

    if (value.exists != null) {
      let esName = await this.client.logicalFieldToES(branch, field.queryFieldName);
      let path = aboveSegments.concat(esName).join('.');
      if (String(value.exists) === 'false') {
        return {
          bool: { must_not: { exists: { field: path } } }
        };
      } else {
        return {
          exists: { field: path }
        };
      }
    }

    if (value.exact != null) {
      let innerQuery = value.exact;
      let esName = await this.client.logicalFieldToES(branch, field.sortFieldName);
      let path = aboveSegments.concat(esName).join('.');

      if(field.isRelationship) {
        if (typeof innerQuery === 'string') {
          // TODO: this completely ignores the possibility of polymorphism
          return { term: { [path] : innerQuery } };
        }
        if (Array.isArray(innerQuery)) {
          return { terms: { [path] : innerQuery } };
        }
      }

      if (typeof innerQuery === 'string') {
        // This is the sortFieldName because that one is designed for
        // exact matching (in addition to sorting).
        return { term: { [path] : innerQuery.toLowerCase() } };
      }
      if (Array.isArray(innerQuery)) {
        // This is the sortFieldName because that one is designed for
        // exact matching (in addition to sorting).
        return { terms: { [path] : innerQuery.map(elt => elt.toLowerCase()) } };
      }
    }

    if (value.prefix != null) {
      let esName = await this.client.logicalFieldToES(branch, field.queryFieldName);
      let path = aboveSegments.concat(esName).join('.');
      return { match_phrase_prefix: { [path] : value.prefix } };
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
    output.push({ '_score': 'desc' });
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


});

async function matchingResourceRealms(document, session) {
    let userRealms;
    if (document.cardstack_resource_realms && document.cardstack_resource_realms.length > 0) {
      userRealms = await session.realms();
      if (userRealms.find(realm => document.cardstack_resource_realms.includes(realm))) {
        return true;
      }
    }
    authLog.info("elasticsearch rejected searcher.get, documentRealms=%j, userRealms=%j", document.cardstack_resource_realms, userRealms);
    // Failed auth check is a 404. We don't want to leak the existence
    // of resources that people don't have permission to access. We
    // return undefined for a missing document.
}
