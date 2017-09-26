const ES = require('elasticsearch');
const logger = require('@cardstack/plugin-utils/logger');
const { isEqual, merge } = require('lodash');
const BulkOps = require('./bulk-ops');

function esURL() {
  return process.env.ELASTICSEARCH || 'http://localhost:9200';
}

const fieldPrefix = '';
const branchPrefix = process.env.ELASTICSEARCH_PREFIX || 'content';

/*
  the SearchClient holds a connection to elasticsearch plus additional
  information about how we're mapping our logical schema into
  elasticsearch's mappings.

  we will use the _meta key in elasticsearch's mappings to give each
  ES field a logical name. Logical names are allowed to collide,
  because different branches can have different types for the same
  field name, whereas real ES fields are not allowed to collide.
*/
module.exports = class SearchClient {
  static async create() {
    let host = esURL();
    let esParams = {
      host,
      log: LogBridge,
      apiVersion: '5.x'
    };

    if (/^aws:/i.test(host)) {
      /*
        AWS's elasticsearch authentication does not compose nicely
        with the regular `elasticsearch` package, so we need a bit of
        special support here.

        To opt into this:

          1. Use "aws" as the protocol in the elasticsearch URL like
             this:

              ELASTICSEARCH=aws://your-domain-here.some-region.es.amazonaws.com

          2. Set the environment variables AWS_SECRET_ACCESS_KEY_ID,
             AWS_SECRET_ACCESS_KEY, and AWS_REGION.

          3. Add the npm modules aws-sdk and http-aws-es to your
             project. You may need to use my fork of http-aws-es
             (git://github.com/ef4/http-aws-es#2dfd0067df5c9196488b5a78a706531ade8e3bba)
             due to their issue #30.

       */
      let AWS = require('aws-sdk');
      let region = process.env.AWS_REGION || 'us-east-1';
      let credentials = new AWS.EnvironmentCredentials('AWS');
      await new Promise((resolve, reject) => {
        credentials.refresh(err => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
      esParams.host = host.replace(/^aws:/i, 'https:');
      esParams.connectionClass = require('http-aws-es');
      esParams.amazonES = { region, credentials };
    }
    return new this(esParams);
  }

  constructor(esParams) {
    this.es = new ES.Client(esParams);
    this.log = logger('es-client');
    this._mappings = null;
  }

  bulkOps({ realTime, batchSize }) {
    return new BulkOps(this.es, { realTime, batchSize });
  }

  async accomodateSchema(branch, schema) {
    let haveMapping = await this._rewriteMapping(branch, await this._esMapping(branch), 'esFieldToLogical');
    let wantMapping = schema.mapping();
    if (this._stableMapping(haveMapping, wantMapping)) {
      this.log.debug('%s: mapping already OK', branch);
    } else {
      this.log.debug('%s: mapping needs update', branch);
      let tmpIndex = this._tempIndexName(branch);
      await this.es.indices.create({
        index: tmpIndex,
        body: {
          mappings: await this._rewriteMapping(branch, wantMapping, 'logicalFieldToES')
        }
      });
      await this._reindex(tmpIndex, branch);
    }
  }

  // this is async because we may not have loaded our mappings, but
  // most of the time we'll have them in memory.
  async logicalFieldToES(branch, logicalFieldName) {
    // _type is special because we always use the native ES _type
    // field, and it never gets remapped.
    if (logicalFieldName === '_type') {
      return logicalFieldName;
    } else {
      return fieldPrefix + logicalFieldName;
    }
  }

  async esFieldToLogical(branch, esFieldName) {
    if (esFieldName === '_type') {
      return esFieldName;
    } else {
      return esFieldName.slice(fieldPrefix.length);
    }
  }

  static branchToIndexName(branch) {
    return `${branchPrefix}_${branch}`;
  }

  static get branchPrefix() {
    return branchPrefix;
  }

  async jsonapiToSearchDoc(id, jsonapiDoc, schema, branch, sourceId) {
    // we store the id as a regular field in elasticsearch here, because
    // we use elasticsearch's own built-in _id for our own composite key
    // that takes into account branches.
    //
    // we don't store the type as a regular field in elasticsearch,
    // because we're keeping it in the built in _type field.

    let rewrites = {};
    let esId = await this.logicalFieldToES(branch, 'id');
    let searchDoc = { [esId]: id };
    if (esId !== 'id') {
      rewrites[esId] = {
        delete: false,
        rename: 'id',
        isRelationship: false
      };
    }

    if (jsonapiDoc.attributes) {
      for (let attribute of Object.keys(jsonapiDoc.attributes)) {
        let value = jsonapiDoc.attributes[attribute];
        let field = schema.fields.get(attribute);
        if (field) {
          let derivedFields = field.derivedFields(value);
          if (derivedFields) {
            for (let [derivedName, derivedValue] of Object.entries(derivedFields)) {
              let esName = await this.logicalFieldToES(branch, derivedName);
              searchDoc[esName] = derivedValue;
              rewrites[esName] = {
                delete: true,
                rename: null,
                isRelationship: false
              };
            }
          }
        }
        let esName = await this.logicalFieldToES(branch, attribute);
        searchDoc[esName] = value;
        if (esName !== attribute) {
          rewrites[esName] = {
            delete: false,
            rename: attribute,
            isRelationship: false
          };
        }
      }
    }
    if (jsonapiDoc.relationships) {
      for (let attribute of Object.keys(jsonapiDoc.relationships)) {
        let value = jsonapiDoc.relationships[attribute];
        let esName = await this.logicalFieldToES(branch, attribute);
        let field = schema.fields.get(attribute);
        if (field) {
          searchDoc[esName] = (value || field.default()).data;
          rewrites[esName] = {
            delete: false,
            rename: esName === attribute ? null : attribute,
            isRelationship: true
          };
        }
      }
    }

    // The next fields in the searchDoc get a "cardstack_" prefix so
    // they aren't likely to collide with the user's attribute or
    // relationship.
    if (jsonapiDoc.meta) {
      searchDoc.cardstack_meta = jsonapiDoc.meta;
    }
    searchDoc.cardstack_rewrites = rewrites;
    searchDoc.cardstack_source = sourceId;
    return searchDoc;
  }

  async _rewriteMapping(branch, mapping, nameRewriter) {
    if (!mapping) { return; }
    let output = {};
    for (let [typeName, typeMapping] of Object.entries(mapping)) {
      let outputTypeMapping = {};
      for (let [fieldName, fieldMapping] of Object.entries(typeMapping.properties)) {
        let esName = await this[nameRewriter](branch, fieldName);
        outputTypeMapping[esName] = fieldMapping;
      }
      output[typeName] = { properties: outputTypeMapping };
    }
    return output;
  }

  async _esMapping(branch) {
    let mapping = await this.es.indices.getMapping({
      index: this.constructor.branchToIndexName(branch),
      ignore: [404]
    });
    if (mapping.status === 404) {
      return null;
    } else {
      let index = Object.keys(mapping)[0];
      return mapping[index].mappings;
    }
  }

  _stableMapping(have, want) {
    if (!have) {
      this.log.info("mapping not stable because there's no existing index");
      return false;
    }

    // the default type is "object", and elasticsearch doesn't echo it
    // back to you even if you are setting it explicitly. So to
    // maintain stability, we fill it in explicitly here before
    // comparing.
    addDefaultTypes(have);

    // Extra information in `have` is OK. There are several cases
    // where elasticsearch fills in more detail than we
    // provide. Missing or different information is not ok and means
    // our mapping is not stable.
    let combined = merge({}, have, want);
    if (isEqual(combined, have)) {
      return true;
    }

    // Not stable. Generate some useful debug info about why.  The %p
    // formatter is custom and loads via side-effect from the
    // diff-log-formatter module.
    this.log.info("mapping diff: %p", { left: have, right: combined });
    return false;
  }

  _tempIndexName(branch) {
    return this.constructor.branchToIndexName(`${branch}_${Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)}`);
  }

  // 1. Index the branch into newIndex.
  // 2. Update the canonical elasticsearch alias for the branch to point at newIndex
  // 3. Delete any old index that we just replaced.
  async _reindex(newIndex, branch) {
    let branchIndex = this.constructor.branchToIndexName(branch);
    let alias = await this.es.indices.getAlias({
      name: branchIndex,
      ignore: [404]
    });
    if (alias.status === 404) {
      this.log.info('%s is new, nothing to reindex', branch);
    } else {
      this.log.info('reindexing %s into %s', branch, newIndex);
      await this.es.reindex({
        body: {
          source: { index: branchIndex },
          dest: { index: newIndex }
        }
      });

    }
    this.log.info('updating alias %s to %s', branchIndex, newIndex);
    await this.es.indices.updateAliases({
      body: {
        actions: [
          { remove: { index: '_all', alias: branchIndex } },
          { add: { index: newIndex, alias: branchIndex } }
        ]
      }
    });

  }


};

class LogBridge {
  constructor(/* config */) {
    this.log = logger('elasticsearch');
  }
  trace(method, requestUrl, body, responseBody, responseStatus) {
    this.log.trace(`${method} ${requestUrl.path} ${responseStatus}`);
  }
  close() {}
}
for (let level of ['error', 'warning', 'info', 'debug']) {
  LogBridge.prototype[level] = function() {
    let ourLevel = level;
    if (level === 'warning') {
      ourLevel = 'warn';
    }
    this.log[ourLevel].apply(this.log, arguments);
  };
}

function addDefaultTypes(mapping) {
  for (let config of Object.values(mapping)) {
    if (config && !config.type) {
      config.type = 'object';
    }
    if (config.properties) {
      addDefaultTypes(config.properties);
    }
  }
}
