const authLog = require('@cardstack/logger')('cardstack/auth');
const log = require('@cardstack/logger')('cardstack/indexing/document-context');
const { Model, privateModels } = require('../model');
const { getPath } = require('@cardstack/routing/cardstack/path');
const { merge, set, get, uniqBy, uniq } = require('lodash');
const Session = require('@cardstack/plugin-utils/session');
const { cardIdFromId, isCard, cardContextFromId } = require('@cardstack/plugin-utils/card-context');
const qs = require('qs');

module.exports = class DocumentContext {

  constructor({ readUpstreamCard, read, search, routers, schema, type, id, sourceId, generation, upstreamDoc, includePaths=[] }) {
    if (upstreamDoc && !upstreamDoc.data) {
      throw new Error('The upstreamDoc must have a top-level "data" property', {
        status: 400
      });
    }
    this.schema = schema;
    this.routers = routers;
    this.type = type;
    this.id = id;
    this.sourceId = sourceId;
    this.generation = generation;
    this.upstreamDoc = upstreamDoc;
    this._read = read;
    this._readUpstreamCard = readUpstreamCard;
    this._search = search;
    this._realms = [];
    this._pendingReads = [];
    this._followedRelationships = {};
    this._routeStack = get(upstreamDoc, 'data.attributes.route-stack');
    this.cache = {};
    this.upstreamCardCache = {};
    this.isCollection = upstreamDoc && upstreamDoc.data && Array.isArray(upstreamDoc.data);
    this.suppliedIncluded = upstreamDoc && upstreamDoc.included;
    this._model = null;
    this.includePaths = uniq(includePaths).map(part => part ? part.split('.') : null).filter(Boolean);

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
        let contentType = this.schema.types.get(doc.type);
        if (!contentType) { throw new Error(`Unknown content type=${doc.type} id=${doc.id}`); }

        return new Model(contentType, doc, this.schema, this.read.bind(this), this.search.bind(this));
      });
    } else {
      let contentType = this.schema.types.get(this.type);
      if (!contentType) { throw new Error(`Unknown content type=${this.type} id=${this.id}`); }

      this._model = new Model(contentType, this.upstreamDoc.data, this.schema, this.read.bind(this), this.search.bind(this));
    }

    return this._model;
  }

  get cardId() {
    return cardIdFromId(this.id);
  }

  get isContextDerivedFromSameCard() {
    if (!this._derivedFrom) { return false; }
    return this.cardId === cardIdFromId(this._derivedFrom);
  }

  async searchDoc() {
    if (this.isCollection) { return; }

    let searchDoc = await this._buildCachedResponse();
    if (!searchDoc) { return; }

    return searchDoc;
  }

  async getOwnCardDocumentContext() {
    if (!isCard(this.id) || this.type === 'cards' || this.type === 'card-definitions') { return this.upstreamDoc; }

    let attributes;
    let primaryModelId = cardIdFromId(this.id);
    let primaryModelType = this.schema.getCardDefinition(this.id).modelContentType.id;
    let { data: card } = (await this._readUpstreamCard(primaryModelId)) || {};

    // TODO card metadata relationships will actually appear as relationships on upstream doc
    if (!card) {
      card = await this.read('cards', primaryModelId);
      attributes = card.attributes;
    } else {
      attributes = await this._getCardMetadata(this.cardId);
    }

    let upstreamCard = {
      id: primaryModelId,
      type: 'cards',
      attributes,
      relationships: {
        model: { data: { type: primaryModelType, id: primaryModelId } },
      }
    };

    let context = await this._deriveDocumentContextForResource(upstreamCard);
    // make sure that the read that we performed to load the primary model for the upstream card is part of the new context's references
    context._references.push(`${this.type}/${this.id}`);
    return context;
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
    return this._references;
  }

  async updateDocumentMeta(meta) {
    await this.pristineDoc();
    if (!this._pristine || !this._pristine.data) { return; }

    this._pristine.data.meta = merge({}, this._pristine.data.meta, meta);
  }

  async read(type, id) {
    log.debug(`Reading record ${type}/${id}`);

    let { modelId/*, upstreamId*/ } = cardContextFromId(id);
    if (modelId != null && cardIdFromId(id) !== this.cardId

    // TODO This clause below is wrong--it means that the upstream ID is not getting processed correctly when getting the doc from the upstream data source
    // This was added from the test pgsearch/node-tests/indexer-test.js: reindexes correctly when related card's models are saved before own card's models
    // if you can get that test passing (which itself has other probs besides this clause), it'd be great to delete this commented out code.
    // && upstreamId !== this.id
    ) {
      throw new Error(`The card 'cards/${this.cardId}' attempted to read the internal model of a foreign card '${type}/${id}'`);
    }

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
      return await cached;
    }

    if (this._pendingReads.includes(key)) {
      throw new Error(`Cycle encountered in DocumentContext.read for ${this.type}/${this.id}. Pending resource reads are ${JSON.stringify(this._pendingReads)}`);
    }
    this._pendingReads.push(key);

    this.cache[key] = this._readOrMakeCard(type, id);
    let resource = await this.cache[key];

    this._pendingReads = this._pendingReads.filter(i => i !== key);
    return resource;
  }

  async _readOrMakeCard(type, id) {
    let resource = await this._read(type, id);

    // this is specifically for the scenario where the card's primary model is being created, and we need to be
    // able to reason about the card that wraps the primary model before it exists in the index.
    if (type === 'cards' && !resource && this.id === id && this.type !== type) {
      return {
        id,
        type: 'cards',
        attributes: await this._getCardMetadata(this.cardId),
        relationships: {
          model: { data: { type: this.type, id } },
        }
      };
    }
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

    let authorizedResource;
    let types = this.schema.types;
    if (Array.isArray(document.data)) {
      authorizedResource = await Promise.all(document.data.map(async resource => {
        if (resource.id == null || resource.type == null) {
          return;
        }

        let type = types.get(resource.type);
        if (!type) {
          return;
        }
        let readAuthorizedResource = await type.applyReadAuthorization(await this._deriveDocumentContextForResource(resource), userRealms);
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
      let contentType = this.schema.types.get(resource.type);
      if (contentType) {
        let authorized = await contentType.applyReadAuthorization(await this._deriveDocumentContextForResource(resource), userRealms);
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

  async _deriveDocumentContextForResource(resource) {
    await this.pristineDoc(); // Need to build up the references and cache

    let context = new DocumentContext({
      type: resource.type,
      id: resource.id,
      upstreamDoc: { data: resource },
      schema: this.schema,
      read: this._read,
      search: this._search,
      routers: this.routers,
    });

    context._derivedFrom = this.id;
    context.cache = this.cache;
    context.suppliedIncluded = this.suppliedIncluded;
    context._routeStack = this._routeStack;
    context._references = this._references;

    return context;
  }

  async _readAuthorizationForPermissions(session, context) {
    // Applying read authorization for permission resources is a special case
    // a permission resource can be read if the subject of the permission object can be read
    if (this.type !== 'permissions') { return; }

    let document = await this.pristineDoc();
    if (!document) { return; }

    let [queryType, queryId] = document.data.id.split('/');
    let permissionsSubjectType = this.schema.types.get(queryType);
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

  async _buildCachedResponse() {
    let searchTree;
    if (!this.isCollection) {
      let contentType = this.schema.types.get(this.type);
      if (!contentType) { return; }

      // TODO make sure to consider the CardDefinitions.defaultMetadataIncludes when dealing with a this.type === 'cards'
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

  async _getCardMetadata(id, depth = 0) {
    if (cardIdFromId(id) === this.cardId &&
      (!this._derivedFrom || this.isContextDerivedFromSameCard)) {
      return await this._getOwnCardMetadata(id, depth);
    }
    return await this._getExternalCardMetadata(id, depth);
  }

  async _getOwnCardMetadata(id, depth) {
    let cardDefinition = this.schema.getCardDefinition(id);
    if (!cardDefinition) { throw new Error(`Tried to retrieve a card with id '${id}' that has no card definition.`); }

    let contentType = cardDefinition.modelContentType;
    let model = await this.read(contentType.id, id);
    if (!model) { return; }

    let userModel = new Model(contentType, model, this.schema, this.read.bind(this), this.search.bind(this));
    let metadata = {};
    for (let field of cardDefinition.metadataFields.values()) {
      if (field.isRelationship) {
        // TODO this logic is not quite correct. what we need to do is to detect if you
        // cross a card boundary. that does not necessary happen just by merit of following a relationship
        // (i.e. depth > 0) we should compare the cardId between this.cardId and the card ID of the relationship
        // we are following.
        if (depth > 0 && !field.neededWhenEmbedded) { continue; }

        let relatedModel = await userModel.getRelated(field.name);
        if (!relatedModel) { continue; }

        if (Array.isArray(relatedModel)) {
          if (relatedModel.some(i => i.type !== 'cards')) {
            throw new Error(`The card ${id} has a metadata relationship field '${field.name}' that points to a non-card models. Only cards can be exposed to the outside world.`);
          }
          metadata[field.name] = await Promise.all(relatedModel.map(i => this._getCardMetadata(i.id, depth + 1)));
        } else {
          if (relatedModel.type !== 'cards') {
            throw new Error(`The card ${id} has a metadata relationship field '${field.name}' that points to a non-card model ${relatedModel.type}/${relatedModel.id}. Metadata relationship fields must be cards, as only cards can be exposed to the outside world.`);
          }
          metadata[field.name] = await this._getCardMetadata(relatedModel.id, depth + 1);
        }
      } else {
        metadata[field.name] = await userModel.getField(field.name);
      }
    }

    return metadata;
  }

  async _getExternalCardMetadata(id) {
    let card = await this.read('cards', id);
    if (!card || !card.attributes) { return; }

    let cardDefinition = this.schema.getCardDefinition(id);
    if (!cardDefinition) { throw new Error(`Tried to retrieve a card with id '${id}' that has no card definition.`); }

    let metadata = {};
    let { attributes } = card;
    for (let field of cardDefinition.embeddedMetadataFields.values()) {
      // No need to descend farther through external card metadata as their own metadata relationships are already being expressed in their embedded form
      metadata[field.name] = attributes[field.name];
    }
    return metadata;
  }

  // copies attribues appropriately from jsonapiDoc into
  // pristineDocOut and searchDocOut.
  async _buildAttributes(contentType, jsonapiDoc, userModel, pristineDocOut, searchDocOut) {
    for (let field of contentType.realAndComputedFields.values()) {
      if (field.id === 'id' || field.id === 'type' || field.isRelationship) {
        continue;
      }
      if (contentType.computedFields.has(field.name) ||
          (jsonapiDoc.attributes && jsonapiDoc.attributes.hasOwnProperty(field.name))) {
        let value = await userModel.getField(field.name);
        await this._buildAttribute(field, value, pristineDocOut, searchDocOut);
      }
     }
  }

  async _buildAttribute(field, value, pristineDocOut, searchDocOut) {
    searchDocOut[field.name] = field.searchIndexFormat(value);
    set(pristineDocOut, `data.attributes.${field.name}`, value);
  }

  async _buildRelationships(contentType, jsonapiDoc, userModel, pristineDocOut, searchDocOut, searchTree, depth, fieldsets) {
    for (let field of contentType.realAndComputedFields.values()) {
      if (!field.isRelationship) {
        continue;
      }
      if (contentType.computedFields.has(field.name) ||
          (jsonapiDoc.relationships && jsonapiDoc.relationships.hasOwnProperty(field.name))) {

        let fieldset = fieldsets && fieldsets.find(f => f.field === field.name);
        await this._buildRelationship(field, pristineDocOut, searchDocOut, searchTree, depth, get(fieldset, 'format'), userModel);
      }
    }
  }

  async _buildRelationship(field, pristineDocOut, searchDocOut, searchTree, depth, format, userModel) {
    let relObj = await userModel.getField(field.name);
    let related;
    if (searchTree[field.name]) {
      let models = await userModel.getRelated(field.name);
      if (Array.isArray(models)) {
        related = await Promise.all(models.map(async (model) => {
          if (model && model.type === 'cards' && model.id === this.cardId) {
            // TODO we might be able to get rid of this "own card" logic now that we are
            // using the native hub invalidation....
            // dont serialize a relationship from an internal model to its outer card until after
            // you know what the pristinedoc is for this internal model, as the card may have metadata
            // that depends on this pristinedoc
            this._includeOwnCard = true;
            return { type: model.type, id: model.id };
          } else {
            return await this._build(model.type, model.id, privateModels.get(model).jsonapiDoc, searchTree[field.name], depth + 1, format);
          }
        }));
        set(pristineDocOut, `data.relationships.${field.name}`, Object.assign({}, relObj, { data: related.map(r => ({ type: r.type, id: r.id })) }));
      } else {
        let model = models;
        if (model && model.type === 'cards' && model.id === this.cardId) {
          // TODO we might be able to get rid of this "own card" logic now that we are
          // using the native hub invalidation....
          related = { type: model.type, id: model.id };
          this._includeOwnCard = true;
        } else if (model) {
          related = await this._build(model.type, model.id, privateModels.get(model).jsonapiDoc, searchTree[field.name], depth + 1, format);
        }
        let data = related ? { type: related.type, id: related.id } : null;
        set(pristineDocOut, `data.relationships.${field.name}`, Object.assign({}, relObj, { data }));
      }
    } else {
      if (relObj && relObj.data) {
        related = relObj.data;
      }
      set(pristineDocOut, `data.relationships.${field.name}`, Object.assign({}, relObj));
    }
    searchDocOut[field.name] = related;
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
        let contentType = this.schema.types.get(resource.type);
        if (!contentType) { continue; }

        let includesTree;
        if (this.includePaths.length) {
          includesTree = {};
          for (let segments of this.includePaths) {
            this._buildSearchTree(includesTree, segments);
          }
        } else {
          // TODO make sure to consider the CardDefinitions.defaultMetadataIncludes when dealing with a cards content-type
          includesTree = Object.assign({}, contentType.includesTree);
        }

        let pristineItem = await this._build(resource.type, resource.id, resource, includesTree, depth + 1);
        assignMeta(pristineItem, jsonapiDoc.data[index]);

        pristine.data.push(pristineItem);
        rootItems.push(`${resource.type}/${resource.id}`);
      }
      assignMeta(pristine, jsonapiDoc);
    } else {
      let contentType = this.schema.types.get(type);
      if (!contentType) {
        log.warn("ignoring unknown document type=%s id=%s", type, id);
        return;
      }

      if (depth === 0 && this.includePaths.length){
        searchTree = {};
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
      let userModel = new Model(contentType, jsonapiDoc, this.schema, this.read.bind(this), this.search.bind(this));
      await this._buildAttributes(contentType, jsonapiDoc, userModel, pristine, searchDoc);

      if (!this._followedRelationships[`${type}/${id}`]) {
        this._followedRelationships[`${type}/${id}`] = true;
        await this._buildRelationships(contentType, jsonapiDoc, userModel, pristine, searchDoc, searchTree, depth, fieldsets);
      }

      assignMeta(pristine.data, jsonapiDoc);
      // TODO we need to change how we build card metadata so that metadata relationships
      // are written as relationships on the card. this will look much closer to how we currently
      // build model attribtues and relationships.
      if (type === 'cards') {
        let metadata = await this._getCardMetadata(id);
        searchDoc = merge({}, searchDoc, metadata);
        pristine.data.attributes = metadata;
      }
    }

    if (depth === 0) {
      this.pristineIncludes = this.pristineIncludes.filter(r => !rootItems.includes(`${r.type}/${r.id}`));
    }

    // top level document embeds all the other pristine includes
    if (this.pristineIncludes.length > 0 && depth === 0) {
      pristine.included = uniqBy(this.pristineIncludes, r => `${r.type}/${r.id}`)
        .filter(r => !(r.type == this.type && r.id == this.id));
    }

    if (depth > 0) {
      await this._addSelfLink(pristine.data);
      this.pristineIncludes = this.pristineIncludes.filter(i => `${i.type}/${i.id}` !== `${pristine.data.type}/${pristine.data.id}`);
      this.pristineIncludes.push(pristine.data);
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

      // We should only load our own card after we have derived the pristine doc, as our card may have metadata
      // that depends on our model's computeds
      if (this._includeOwnCard) {
        let card = await this.read('cards', this.cardId);
        card.attributes = await this._getCardMetadata(this.cardId);
        pristine.included = (pristine.included || []).concat([card]);
        this._pristine = pristine;
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