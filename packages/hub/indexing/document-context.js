const authLog = require('@cardstack/logger')('cardstack/auth');
const log = require('@cardstack/logger')('cardstack/indexing/document-context');
const { Model, privateModels } = require('../model');
const { getPath } = require('@cardstack/routing/cardstack/path');
const { merge, get, uniqBy, uniq } = require('lodash');
const Session = require('@cardstack/plugin-utils/session');
const {
  getCardId,
  isInternalCard,
  loadCard,
} = require('@cardstack/plugin-utils/card-utils');
const qs = require('qs');

module.exports = class DocumentContext {

  constructor({ read, search, routers, schema, type, id, sourceId, generation, upstreamDoc, format, includePaths }) {
    if (upstreamDoc && !upstreamDoc.data) {
      throw new Error('The upstreamDoc must have a top-level "data" property', {
        status: 400
      });
    }
    this.schema = schema;
    this.routers = routers;
    this.type = type;
    this.format = format;
    this.id = id;
    this.sourceId = sourceId;
    this.generation = generation;
    this.upstreamDoc = upstreamDoc;
    this.includePaths = includePaths ? includePaths.map(part => part ? part.split('.') : null).filter(i => Boolean(i)) : [];
    this._read = read;
    this._search = search;
    this._realms = [];
    this._pendingReads = [];
    this._followedRelationships = {};
    this._routeStack = get(upstreamDoc, 'data.attributes.route-stack');
    this.cache = {};
    this._cardCache = {};
    this.isCollection = upstreamDoc && upstreamDoc.data && Array.isArray(upstreamDoc.data);
    this.suppliedIncluded = upstreamDoc && upstreamDoc.included || [];
    this._model = null;

    // included resources that we actually found
    this.pristineIncludes = [];

    // references to included resource that were both found or
    // missing. We track the missing ones so that if they later appear
    // in the data we can invalidate to pick them up.
    this._references = [];

    // special case for the built-in implicit relationship between
    // user-realms and the underlying user record it is tracking
    let user = get(upstreamDoc, 'data.relationships.user.data');
    if (type === 'user-realms' && user) {
      this._references.push(`${user.type}/${user.id}`);
    }
  }

  get model() {
    if (this._model) { return this._model; }

    if (this.isCollection) {
      this._model = this.upstreamDoc.data.map(doc => {
        let contentType = this.schema.getType(doc.type);
        if (!contentType) { throw new Error(`Unknown content type=${doc.type} id=${doc.id}`); }

        return new Model(contentType, doc, this.schema, this.read.bind(this), this.getCard.bind(this), this.search.bind(this), this.cardIdContext);
      });
    } else {
      let contentType = this.schema.getType(this.type);
      if (!contentType) { throw new Error(`Unknown content type=${this.type} id=${this.id}`); }

      this._model = new Model(contentType, this.upstreamDoc.data, this.schema, this.read.bind(this), this.getCard.bind(this), this.search.bind(this), this.cardIdContext);
    }

    return this._model;
  }

  get cardIdContext() {
    return isInternalCard(this.type, this.id) ? this.id : null;
  }

  async searchDoc() {
    if (this.isCollection) { return; }

    let searchDoc = await this._buildCachedResponse();
    if (!searchDoc) { return; }

    return searchDoc;
  }

  async pristineDoc() {
    await this._buildCachedResponse();
    return this._pristine;
  }

  async realms() {
    if (this.isCollection) { return; }

    await this._buildCachedResponse();
    return this._realms;
  }

  async references() {
    if (this.isCollection) { return; }

    await this._buildCachedResponse();
    return uniq(this._references);
  }

  async updateDocumentMeta(meta) {
    this.upstreamDoc.data.meta = merge({}, this.upstreamDoc.data.meta, meta);
    await this.pristineDoc();
    if (!this._pristine || !this._pristine.data) { return; }

    this._pristine.data.meta = merge({}, this._pristine.data.meta, meta);
  }

  async read(type, id) {
    log.debug(`Reading record ${type}/${id}`);

    this._references.push(`${type}/${id}`);

    let key = `${type}/${id}`;
    if (get(this, 'upstreamDoc.data.id') === id && get(this, 'upstreamDoc.data.type') === type) {
      return this.upstreamDoc.data;
    }

    let includedResource = this.suppliedIncluded ? this.suppliedIncluded.find(i => key === `${i.type}/${i.id}`) : null;
    if (includedResource) {
      return includedResource;
    }

    let cached = this.cache[key];
    if (cached) {
      log.debug(`document with key ${key} is in cache, fetching...`);
      let document = await cached;
      return document && document.data;
    }

    if (this._pendingReads.includes(key)) {
      throw new Error(`Cycle encountered in DocumentContext.read for ${this.type}/${this.id}. Pending resource reads are ${JSON.stringify(this._pendingReads)}`);
    }
    this._pendingReads.push(key);

    this.cache[key] = this._read(type, id);
    let document = await this.cache[key];
    let resource = document && document.data;

    this._pendingReads = this._pendingReads.filter(i => i !== key);
    return resource;
  }

  async search(query) {
    let key = `/api?${qs.stringify(query)}`;

    log.debug(`Searching for records via ${key}`);

    this._references.push(`${key}`);

    let cached = this.cache[key];
    if (cached) {
      log.debug(`document with key ${key} is in cache, fetching...`);
      return await cached;
    }

    if (this._pendingReads.includes(key)) {
      throw new Error(`Cycle encountered in DocumentContext.search for ${key}. Pending resource searches are ${JSON.stringify(this._pendingReads)}`);
    }
    this._pendingReads.push(key);

    this.cache[key] = this._search(query);
    let resource = await this.cache[key];

    this._pendingReads = this._pendingReads.filter(i => i !== key);
    return resource;
  }

  // Makes the pristineDoc safe to
  // show within the given context. If it can't be shown at all
  // (because the primary resource is not readable), we return
  // undefined.
  //
  // Otherwise, we go through each included resource and field to
  // ensure there are valid grants for them. We return a new sanitized
  // document that strips out any included resources or fields that
  // were lacking grants.
  async applyReadAuthorization(context={}) {
    let session = context.session || Session.EVERYONE;
    let userRealms = await session.realms();
    let document = await this.pristineDoc();
    if (!document) { return; }

    let authorizedResource;
    let types = this.schema.getTypes();
    if (Array.isArray(document.data)) {
      authorizedResource = await Promise.all(document.data.map(async resource => {
        if (resource.id == null || resource.type == null) {
          return;
        }

        let type = types.get(resource.type);
        if (!type) {
          return;
        }
        let readAuthorizedResource = await type.applyReadAuthorization(this._deriveDocumentContextForResource(resource), userRealms);
        return readAuthorizedResource;
      }));
      authorizedResource = authorizedResource.filter(Boolean);
    } else {
      if (document.data.id == null || document.data.type == null) {
        return;
      }

      let primaryType = types.get(document.data.type);
      if (!primaryType) {
        return;
      }
      if (document.data.type === 'permissions') {
        authorizedResource = await this._readAuthorizationForPermissions(session, context);
      } else {
        authorizedResource = await primaryType.applyReadAuthorization(this, userRealms);
        if (!authorizedResource) {
          return;
        }
      }
    }

    let output = document;

    if (document.data !== authorizedResource) {
      output = {
        data: authorizedResource
      };
      if (document.meta) {
        output.meta = document.meta;
      }
    }

    if (document.included) {
      let safeIncluded = await this._readAuthIncluded(document.included, userRealms);
      if (safeIncluded === document.included) {
        // the include list didn't need to be modified. If our output
        // is a modified copy, we need to bring the original included
        // list along. If our document is not a copy, it already has
        // the original included list.
        if (output !== document) {
          output.included = document.included;
        }
      } else {
        // we need to modify included. First copy the output document
        // if we didn't already.
        if (output === document) {
          output = { data: document.data };
          if (document.meta) {
            output.meta = document.meta;
          }
        }
        output.included = safeIncluded;
      }
    }

    if (output !== document && output.included) {
      // we altered something, so lets verify "full linkage" as
      // required by the spec
      // http://jsonapi.org/format/#document-compound-documents


      let allResources = new Map();
      if (Array.isArray(output.data)) {
        for (let resource of output.data) {
          allResources.set(`${resource.type}/${resource.id}`, resource);
        }
      } else {
        allResources.set(`${output.data.type}/${output.data.id}`, output.data);
      }

      if (output.included) {
        for (let resource of output.included) {
          allResources.set(`${resource.type}/${resource.id}`, resource);
        }
      }

      let reachable = new Set();
      let pending = Array.isArray(output.data) ? output.data.slice() : [output.data];

      while (pending.length > 0) {
        let resource = pending.pop();
        if (!resource.relationships) {
          continue;
        }

        for (let value of Object.values(resource.relationships)) {
          if (value && value.data) {
            let references;
            if (Array.isArray(value.data)) {
              references = value.data;
            } else {
              references = [value.data];
            }
            for (let { type, id } of references) {
              let key = `${type}/${id}`;
              if (!reachable.has(key)) {
                reachable.add(key);
                let resource = allResources.get(key);
                if (resource) {
                  pending.push(resource);
                }
              }
            }
          }
        }
      }
      let linkedIncluded = output.included.filter(resource => reachable.has(`${resource.type}/${resource.id}`));
      if (linkedIncluded.length < output.included.length) {
        // must replace output.included. output is necessarily already
        // copied (or we wouldn't be checking linkage in the first
        // place)
        output.included = linkedIncluded;
      }
    }

    return output;
  }

  async _readAuthIncluded(included, userRealms) {
    let modified = false;
    let safeIncluded = await Promise.all(included.map(async resource => {
      let contentType = this.schema.getType(resource.type);
      if (contentType) {
        let authorized = await contentType.applyReadAuthorization(this._deriveDocumentContextForResource(resource), userRealms);
        if (authorized !== resource) {
          modified = true;
        }
        return authorized;
      }
    }));
    if (modified) {
      return safeIncluded.filter(Boolean);
    } else {
      return included;
    }
  }

  // DocumentContexts created here should derive from `this` and be able to leverage
  // the cache and routing context from `this`'s DocumentContext
  _deriveDocumentContextForResource(resource) {
    let context = new DocumentContext({
      type: resource.type,
      id: resource.id,
      upstreamDoc: { data: resource },
      schema: this.schema,
      read: this._read,
      format: this.format,
      search: this._search,
      routers: this.routers
    });
    context.cache = this.cache;
    context._cardCache = this._cardCache;
    context._routeStack = this._routeStack;
    context.suppliedIncluded = this.suppliedIncluded;

    return context;
  }

  async _readAuthorizationForPermissions(session, context) {
    // Applying read authorization for permission resources is a special case
    // a permission resource can be read if the subject of the permission object can be read
    if (this.type !== 'permissions') { return; }

    let document = await this.pristineDoc();
    if (!document) { return; }

    let [queryType, queryId] = document.data.id.split('/');
    let permissionsSubjectType = this.schema.getType(queryType);
    let permissionsSubject = {};
    if (!queryId) {
      // Checking grants should always happen on a document
      // so in the case we don't have one to check, we need to
      // to assemble a document from what we know about the fields
      permissionsSubject = {
        data: {
          type: queryType
        }
      };
    } else {
      permissionsSubject = { data: await this.read(queryType, queryId) };
    }
    try {
      await permissionsSubjectType._assertGrant([permissionsSubject.data], context, 'may-read-resource', 'read');
      return document.data;
    } catch (error) {
      if (!error.isCardstackError) {
        throw error;
      }
    }
  }

  // Treating this separately from the read() function because we need
  // cards as JSON:API documents in order to derive the card schema,
  // and read() only returns resources.
  async getCard(id) {
    let cardResource;
    let docId = get(this, 'upstreamDoc.data.id');
    let docType = get(this, 'upstreamDoc.data.type');
    this._references.push(`${id}/${id}`);

    if (isInternalCard(docId, docType) &&
      docId === id &&
      (
        get(this, 'upstreamDoc.included.length') ||
        (!get(this, 'upstreamDoc.data.relationships.fields.data.length') &&
          !get(this, 'upstreamDoc.data.relationships.adopted-from.data.length')
        )
      )) {
      return this.upstreamDoc;
    } else if (isInternalCard(docId, docType) && docId === id) {
      let card = {
        data: this.upstreamDoc.data,
        included: await this.crawlInternalModels(this.upstreamDoc.data)
      };
      this._cardCache[id] = card;
      return card;
    } else if (this.upstreamDoc &&
      this.upstreamDoc.data &&
      Array.isArray(this.upstreamDoc.data) &&
      (cardResource = this.upstreamDoc.data.find(i => isInternalCard(i.type, i.id) && i.id === id))
    ) {
      let card = {
        data: cardResource,
        included: (this.upstreamDoc.included || []).filter(i => i.type.includes(id) || i.id.includes(id))
      };
      this._cardCache[id] = card;
      return card;
    }
    let cached = this._cardCache[id];
    if (cached) {
      return await this._cardCache[id];
    }
    this._cardCache[id] = this._read(id, id);
    return await this._cardCache[id];
  }

  async crawlInternalModels(resource, models = []) {
    if (isInternalCard(resource.type, resource.id) && this.id !== resource.id) { return models; }

    for (let relationship of Object.keys(resource.relationships || {})) {
      let linkage = get(resource, `relationships.${relationship}.data`);
      if (!linkage) { continue; }
      if (Array.isArray(linkage)) {
        for (let fieldRef of linkage) {
          let related = await this.read(fieldRef.type, fieldRef.id);
          if (!related) { continue; }
          models.push(related);
          await this.crawlInternalModels(related, models);
        }
      } else {
        let related = await this.read(linkage.type, linkage.id);
        if (!related) { continue; }
        models.push(related);
        await this.crawlInternalModels(related, models);
      }
    }
    return models;
  }

  // TODO eventually we'll want to load the card types and fields from the schema getters
  // themselves when a card based type/field is being requested. Reminder to chat with Ed
  // around how the schema can find the card document when a caller wants a card type/field schema--
  // unsure how we would use a searchers.get() within the Schema class; I think that would
  // result in a cycle as searchers.get() needs to use a schema itself in order to process results.
  async _loadCardSchemaForResource(resourceType, resourceId) {
    let id;
    if (!resourceType || !(id = getCardId(resourceId))) { return; }

    if (this._cardCache[id]) {
      await this._cardCache[id];
      return;
    }

    this._cardCache[id] = this._updateSchema(id);
    await this._cardCache[id];
  }

  async _updateSchema(cardId) {
    let card = await this.getCard(cardId);
    if (!card) { return; } // assume that the caller has provided the card schema already;

    let adoptedFromId = get(card, 'data.relationships.adopted-from.data.id');
    if (adoptedFromId) {
      await this._updateSchema(adoptedFromId);
    }
    let cardSchema = await loadCard(this.schema, card, this.getCard.bind(this));
    this.schema = await this.schema.applyChanges(cardSchema.map(document => ({ id:document.id, type:document.type, document })));
  }

  async _buildCachedResponse() {
    let searchTree;
    if (!this.isCollection && !isInternalCard(this.type, this.id)) {
      let contentType = this.schema.getType(this.type);
      if (!contentType) { return; }

      searchTree = contentType.includesTree;
    }

    if (!this._searchDoc) {
      log.debug(`Building ${this.type}/${this.id}`);
      this._searchDoc = this.upstreamDoc ? await this._build(this.type, this.id, this.upstreamDoc, searchTree, 0) : {};
    }
    if (this._searchDoc) {
      return Object.assign({}, this._searchDoc);
    }
  }

  // copies attribues appropriately from jsonapiDoc into
  // pristineDocOut and searchDocOut.
  async _buildAttributes(contentType, jsonapiDoc, userModel, pristineDocOut, searchDocOut) {
    for (let field of contentType.realAndComputedFields.values()) {
      if (field.id === 'id' || field.id === 'type' || field.isRelationship) {
        continue;
      }
      if (contentType.computedFields.has(field.id) ||
          (jsonapiDoc.attributes && jsonapiDoc.attributes.hasOwnProperty(field.id))) {
        let value = await userModel.getField(field.id);
        await this._buildAttribute(field, value, pristineDocOut, searchDocOut);
      }
     }
  }

  async _buildAttribute(field, value, pristineDocOut, searchDocOut) {
    // Write our value into the search doc
    searchDocOut[field.id] = field.searchIndexFormat(value);
    // Write our value into the pristine doc
    ensure(pristineDocOut, 'attributes')[field.id] = value;
  }

  async _buildRelationships(contentType, jsonapiDoc, userModel, pristineDocOut, searchDocOut, searchTree, depth, fieldsets) {
    for (let field of contentType.realAndComputedFields.values()) {
      if (!field.isRelationship) {
        continue;
      }
      if (contentType.computedFields.has(field.id) ||
          (jsonapiDoc.relationships && jsonapiDoc.relationships.hasOwnProperty(field.id))) {

        let fieldset = fieldsets && fieldsets.find(f => f.field === field.id);
        await this._buildRelationship(field, pristineDocOut, searchDocOut, searchTree, depth, get(fieldset, 'format'), userModel);
      }
    }
  }

  async _buildRelationship(field, pristineDocOut, searchDocOut, searchTree, depth, format, userModel) {
    let relObj = await userModel.getField(field.id);
    let related;
    if (searchTree[field.id]) {
      let models = await userModel.getRelated(field.id);
      this.schema = userModel.schema; // this will incorporate any discovered card schema as a result of traversing the relationship
      if (Array.isArray(models)) {
        related = await Promise.all(models.map(async (model) => {
          return this._build(model.type, model.id, privateModels.get(model).jsonapiDoc, searchTree[field.id], depth + 1, format);
        }));
        ensure(pristineDocOut, 'relationships')[field.id] = Object.assign({}, relObj, { data: related.filter(Boolean).map(r => ({ type: r.type, id: r.id })) });
      } else {
        let model = models;
        if (model) {
          related = await this._build(model.type, model.id, privateModels.get(model).jsonapiDoc, searchTree[field.id], depth + 1, format);
        }
        let data = related ? { type: related.type, id: related.id } : null;
        ensure(pristineDocOut, 'relationships')[field.id] = Object.assign({}, relObj, { data });
      }
    } else {
      if (relObj.data) {
        related = relObj.data;
      }
      ensure(pristineDocOut, 'relationships')[field.id] = Object.assign({}, relObj);
    }
    searchDocOut[field.id] = related;
  }

  _buildSearchTree(searchTree, segments) {
    if (!segments.length) { return {}; }

    let childNode = searchTree[segments[0]] || {};
    searchTree[segments[0]] = merge(childNode, this._buildSearchTree(Object.assign({}, childNode), segments.slice(1)));

    return searchTree;
  }

  // If a routing card is not provided to the DocumentContext, then leverage the application card
  // to determine the context in which to resolve the canonical URL for the card.
  async _addSelfLink(jsonapiDoc) {
    if (!this.routers) { return; }

    let routeStackCards = [];
    if (this._routeStack && this._routeStack.length) {
      for (let routingCardIdentifier of this._routeStack) {
        let [type, id] = routingCardIdentifier.split('/');
        routeStackCards.push({ data: await this.read(type, id) });
      }
    } else if (this.routers.applicationCard) {
      routeStackCards.push(this.routers.applicationCard);
    }
    if (!routeStackCards.length) { return; }

    let path = await getPath(routeStackCards,
      { data: jsonapiDoc },
      (await this.routers.getRoutersInfo()).routerMapByDepth);
    if (path) {
      jsonapiDoc.links = jsonapiDoc.links || {};
      jsonapiDoc.links.self = path;
    }
  }

  async _build(type, id, jsonapiDoc, searchTree, depth, fieldsetFormat) {
    let isCollection = this.isCollection && depth === 0;
    let searchDoc = isCollection ? {} : { ['id']: id };

    // this is the copy of the document we will return to anybody who
    // retrieves it. It's supposed to already be a correct jsonapi
    // response, as opposed to the searchDoc itself which is mangled
    // for searchability.
    let pristine = isCollection ? { data: [] } : { data: { id, type } };
    let rootItems = [];

    if (isCollection) {
      for (let [index, resource] of jsonapiDoc.data.entries()) {

        await this._loadCardSchemaForResource(resource.type, resource.id);
        let contentType = this.schema.getType(resource.type);
        if (!contentType) { continue; }

        let includesTree;
        let includePaths = this.includePaths;
        includesTree = {};
        if (includePaths.length) {
          for (let segments of includePaths) {
            this._buildSearchTree(includesTree, segments);
          }
        } else {
          if (isInternalCard(resource.type, resource.id)) {
            let contentType = this.schema.getType(resource.type);
            includesTree = Object.assign({}, contentType.includesTree);
          } else {
            includesTree = Object.assign({}, contentType.includesTree);
          }
        }

        let pristineItem = await this._build(resource.type, resource.id, resource, includesTree, depth + 1);
        assignMeta(pristineItem, jsonapiDoc.data[index]);

        pristine.data.push(pristineItem);
        rootItems.push(`${resource.type}/${resource.id}`);
      }
      assignMeta(pristine, jsonapiDoc);
    } else {
      // I think processing relationships that use `link` are not working right--as
      // we are not resolving the link queries to type/id before _build() is called.
      if (!type) { return; }

      await this._loadCardSchemaForResource(type, id);
      let contentType = this.schema.getType(type);
      if (!contentType) {
        log.warn("ignoring unknown document type=%s id=%s", type, id);
        return;
      }

      if (depth === 0 && (this.includePaths.length || isInternalCard(type, id))) {
        searchTree = {};
        if (isInternalCard(type, id)) {
          let contentType = this.schema.getType(type);
          searchTree = contentType.includesTree;
        }
        for (let segments of this.includePaths) {
          this._buildSearchTree(searchTree, segments);
        }
      }

      let fieldsets = get(contentType, `fieldsets.${fieldsetFormat || contentType.fieldsetExpansionFormat}`);
      if (fieldsets && fieldsets.length) {
        for (let { field:fieldPath } of fieldsets) {
          this._buildSearchTree(searchTree, fieldPath.split('.'));
        }
      }

      if (depth > 0) {
        // we are going inside a parent document's includes, so we need
        // our own type here.
        searchDoc['type'] = type;
      } else {
        jsonapiDoc = jsonapiDoc.data;
      }
      let userModel = new Model(contentType, jsonapiDoc, this.schema, this.read.bind(this), this.getCard.bind(this), this.search.bind(this), this.cardIdContext);
      await this._buildAttributes(contentType, jsonapiDoc, userModel, pristine, searchDoc);

      if (!this._followedRelationships[`${type}/${id}`]) {
        this._followedRelationships[`${type}/${id}`] = true;
        await this._buildRelationships(contentType, jsonapiDoc, userModel, pristine, searchDoc, searchTree, depth, fieldsets);
      }

      assignMeta(pristine.data, jsonapiDoc);
    }

    if (depth === 0) {
      this.pristineIncludes = this.pristineIncludes.filter(r => !rootItems.includes(`${r.type}/${r.id}`));
    }

    // top level document embeds all the other pristine includes
    if (this.pristineIncludes.length > 0 && depth === 0) {
      pristine.included = uniqBy([pristine].concat(this.pristineIncludes), r => `${r.type}/${r.id}`)
        .slice(1)
        .filter(r => !(r.type == type && r.id == id));
    }

    if (depth > 0) {
      await this._addSelfLink(jsonapiDoc);
      this.pristineIncludes.push(jsonapiDoc);
    } else {
      await this._addSelfLink(pristine.data);
      this._pristine = pristine;
      if (!isCollection) {
        if (this.sourceId != null) {
          this._pristine.data.meta.source = this.sourceId;
        }
        this._realms = await this.schema.authorizedReadRealms(type, this);
        authLog.trace("setting resource_realms for %s %s: %j", type, id, this._realms);
      }
    }
    if (this.isCollection && depth === 1) {
      return pristine.data;
    }
    return searchDoc;
  }

};

function assignMeta(pristine, resource) {
  if (resource.meta) {
    pristine.meta = Object.assign({}, resource.meta);
  } else {
    pristine.meta = {};
  }
}

function ensure(obj, section) {
  if (!obj.data[section]) {
    obj.data[section] = {};
  }
  return obj.data[section];
}
