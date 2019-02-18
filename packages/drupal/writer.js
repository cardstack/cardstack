const PendingChange = require('@cardstack/plugin-utils/pending-change');
const Error = require('@cardstack/plugin-utils/error');
const { URL } = require('url');
const request = require('superagent');
const { isEqual } = require('lodash');
const { drupalToCardstackDoc, cardstackToDrupalDoc } = require('./lib/document');
const pendingChanges = new WeakMap();
const log = require('@cardstack/logger')('cardstack/drupal');

module.exports = class Writer {
  static create(params) {
    return new this(params);
  }
  constructor({ url, authToken, dataSource }) {
    this.url = url;
    this.authToken = authToken;
    this._schema = null;
    this.dataSource = dataSource;
  }

  async _getSchema() {
    if (!this._schema) {
      let updater = await this.dataSource.indexer.beginUpdate('master');
      try {
        this._schema = await updater._loadSchema();
      } finally {
        if (updater.destroy) {
          await updater.destroy();
        }
      }
    }
    return this._schema;
  }

  async _findURL(type) {
    let { endpoints } = await this._getSchema();
    let endpoint = endpoints[type];
    if (!endpoint) {
      throw new Error(`No drupal API endpoint was discovered for writing type ${type}`, {
        status: 400
      });
    }
    return new URL(endpoint, this.url).href;
  }

  async prepareCreate(branch, session, type, document, isSchema) {
    this._assertNotSchema(isSchema);
    let url = await this._findURL(type);
    let token = this.authToken;
    let { models: schemaModels } = await this._getSchema();
    let change = new PendingChange(null, document, finalize);
    pendingChanges.set(change, { url, token, method: 'post', schemaModels });
    return change;
  }

  async prepareUpdate(branch, session, type, id, document, isSchema) {
    this._assertNotSchema(isSchema);
    let url = (await this._findURL(type)) + '/' + id;
    let response = await request.get(url);
    let { models: schemaModels } = await this._getSchema();
    let originalDocument = drupalToCardstackDoc(response.body.data, schemaModels);
    let change = new PendingChange(originalDocument, patch(originalDocument, document), finalize);
    let token = this.authToken;
    pendingChanges.set(change, { url, token, method: 'patch', schemaModels });
    return change;
  }

  async prepareDelete(branch, session, version, type, id, isSchema) {
    this._assertNotSchema(isSchema);
    throw new Error("Unimplemented");
  }

  async _assertNotSchema(isSchema) {
    if (isSchema) {
      throw new Error("The @cardstack/drupal plugin does not support Schema modification", {
        status: 400
      });
    }
  }

};

async function finalize(change) {
  let { method, url, token, schemaModels } = pendingChanges.get(change);

  let p = request[method](url)
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .set('Authorization', `Bearer ${token}`);

  let payload = diff(change);
  if (payload) {
    let data = cardstackToDrupalDoc(payload, schemaModels);
    p = p.send({ data });
  }

  try {
    await p;
  } catch (err) {
    if (err.response) {
      log.error("Drupal response %s: %s", err.status, JSON.stringify(err.response.body, null, 2));
    }
    throw err;
  }
}

// TODO: we only need to do this here because the Hub has no generic
// "read" hook to call on writers. We should use that instead and move
// this into the generic hub:writers code.
function patch(before, diffDocument) {
  let after = Object.assign({}, before);
  for (let section of ['attributes', 'relationships']) {
    if (diffDocument[section]) {
      after[section] = Object.assign(
        {},
        before[section],
        diffDocument[section]
      );
    }
  }
  return after;
}

function diff({ originalDocument, finalDocument }) {
  if (originalDocument && finalDocument) {
    let d = {
      id: finalDocument.id,
      type: finalDocument.type,
      attributes: {
      },
      relationships: {
      },
      meta: finalDocument.meta
    };
    for (let [key, value] of Object.entries(finalDocument.attributes)) {
      if (!isEqual(originalDocument.attributes[key], value)) {
        d.attributes[key] = value;
      }
    }
    for (let [key, value] of Object.entries(finalDocument.relationships)) {
      if (!isEqual(originalDocument.relationships[key], value)) {
        d.relationships[key] = value;
      }
    }
    return d;
  } else if (finalDocument) {
    return finalDocument;
  }
}
