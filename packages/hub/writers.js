const Error = require('@cardstack/plugin-utils/error');
const Session = require('@cardstack/plugin-utils/session');
const log = require('@cardstack/logger')('cardstack/writers');
const performanceLog = require('@cardstack/logger')('cardstack/performance/writers');
const { set, get, differenceBy, intersectionBy, partition, merge } = require('lodash');
const { declareInjections } = require('@cardstack/di');
const {
  isInternalCard,
  loadCard,
  getCardId,
  adoptionChain,
  adaptCardToFormat,
  generateInternalCardFormat
} = require('@cardstack/plugin-utils/card-utils');

module.exports = declareInjections({
  currentSchema: 'hub:current-schema',
  schemaLoader: 'hub:schema-loader',
  searchers: 'hub:searchers',
  pgSearchClient: `plugin-client:${require.resolve('@cardstack/pgsearch/client')}`
},

class Writers {
  get schemaTypes() {
    return this.schemaLoader.ownTypes();
  }

  async create(session, type, document) {
    log.info("creating type=%s", type);
    if (!document.data) {
      throw new Error('The document must have a top-level "data" property', {
        status: 400
      });
    }

    return await this.handleCreate(false, session, type, document);
  }

  async createBinary(session, type, stream) {
    log.info("creating type=%s from binary stream", type);
    if (!stream.read) {
      throw new Error('The passed stream must be a readable binary stream', {
        status: 400
      });
    }

    return await this.handleCreate(true, session, type, stream);
  }

  async handleCardDeleteOperation(session, id) {
    let internalCard;
    try {
      internalCard = await this.searchers.get(Session.INTERNAL_PRIVILEGED, 'local-hub', id, id);
    } catch (e) {
      if (e.status !== 404) { throw e; }
    }
    if (!internalCard) { return {}; }

    return await this.handleCardOperations(session, internalCard, true);
  }

  async handleCardOperations(session, card, isDeletion) {
    let schema, context, internalCard, oldCard;
    let id = card.data.id;
    if (isDeletion) {
      internalCard = card;
      ({ context, schema } = await this._loadInternalCardSchema(internalCard));
    } else {
      ({ schema, context, internalCard } = await this._loadInternalCardSchema(card));
      try {
        oldCard = await this.searchers.get(Session.INTERNAL_PRIVILEGED, 'local-hub', id, id);
      } catch (e) {
        if (e.status !== 404) { throw e; }
      }
    }

    let addedModels = [];
    let deletedModels = [];
    let changedModels = [];
    let ignoredModels = (internalCard.included || []).filter(i => getCardId(i.id) !== id)
      .concat(((oldCard && oldCard.included) || []).filter(i => getCardId(i.id) !== id));

    if (isDeletion) {
      deletedModels = [internalCard.data].concat(internalCard.included || []);
    } else if (oldCard) {
      changedModels = intersectionBy(internalCard.included || [], oldCard.included || [], i => `${i.type}/${i.id}`);
      addedModels = differenceBy(internalCard.included || [], oldCard.included || [], i => `${i.type}/${i.id}`);
      deletedModels = differenceBy(oldCard.included || [], internalCard.included || [], i => `${i.type}/${i.id}`);
    } else {
      addedModels = internalCard.included || [];
    }

    addedModels = differenceBy(addedModels, ignoredModels, i => `${i.type}/${i.id}`);
    deletedModels = differenceBy(deletedModels, ignoredModels, i => `${i.type}/${i.id}`);
    changedModels = differenceBy(changedModels, ignoredModels, i => `${i.type}/${i.id}`);

    let beforeFinalize = async (currentSchema) => {
      // the new schema may be missing deleted resources which will be important to have in order
      // for invalidated documents that have deleted schema to be reasoned about correctly
      let localSchema = await currentSchema.applyChanges(deletedModels.map(document => ({ type: document.type, id: document.id, document })));
      // TODO can we run all these concurrently?
      for (let resource of addedModels) {
        let { data: { meta } } = await this.handleCreate(false, session, resource.type, {
          data: resource,
          included: [internalCard.data].concat(internalCard.included || [])
        }, localSchema, true);
        let includedResource = (internalCard.included || []).find(i => `${i.type}/${i.id}` === `${resource.type}/${resource.id}`);
        if (!includedResource) { continue; }
        includedResource.meta = merge({}, includedResource.meta, meta);
      }
    // TODO can we run all these concurrently?
      for (let resource of changedModels) {
        let { data: { meta } } = await this.update(session, resource.type, resource.id, {
          data: resource,
          included: [internalCard.data].concat(internalCard.included || [])
        }, localSchema, true);
        let includedResource = (internalCard.included || []).find(i => `${i.type}/${i.id}` === `${resource.type}/${resource.id}`);
        if (!includedResource) { continue; }
        includedResource.meta = merge({}, includedResource.meta, meta);
      }
    };

    // Don't delete schema until after the card model has been updated so that
    // you don't end up with a content type referring to a missing field
    let afterFinalize = async (originalDocumentSchema, newDocumentSchema) => {
      // Any schema that needs to be deleted should leverage the schema derived from the document from before it was updated
      // as the new schema, by merit of the fact we are deleting it, no longer describes this resource
      let updatedSchema = await this._deleteInternalCardResources(session, originalDocumentSchema || newDocumentSchema, deletedModels);
      // deleting card schema can result in deleted schema resource which will need to be shared with the outside world
      return updatedSchema;
    };

    return { internalCard, schema, beforeFinalize, afterFinalize, context };
  }

  // TODO add timing logs
  async handleCreate(isBinary, session, type, documentOrStream, schema, indexOnly) {
    let handleCreateStart = Date.now();
    await this.pgSearchClient.ensureDatabaseSetup();

    schema = schema || await this.currentSchema.getSchema();
    let context, beforeFinalize, id;
    if (type === 'cards') {
      let handleCardOperationsStart = Date.now();
      ({ context, schema, internalCard: documentOrStream, beforeFinalize } = await this.handleCardOperations(session, documentOrStream));
      ({ type, id } = documentOrStream.data);
      performanceLog.debug(`create ${type}/${documentOrStream.data.id} time to complete handleCardOperations: ${Date.now() - handleCardOperationsStart}ms`);
    }

    let pending;
    let { writer, sourceId } = await this._getSchemaDetailsForType(schema, type, id, documentOrStream);
    if (isInternalCard(type, documentOrStream.data && documentOrStream.data.id) &&
      !writer.hasCardSupport) {
      let source = schema.getDataSource(sourceId);
      throw new Error(`The configured writer for cards documents, 'data-sources/${sourceId}' (source type '${source.sourceType}'), does not have card support`);
    }
    if (isBinary) {
      let opts = await writer.prepareBinaryCreate(
        session,
        type,
        documentOrStream
      );
      let { originalDocument, finalDocument, finalizer, aborter } = opts;
      pending = await this.createPendingChange({ type, originalDocument, finalDocument, finalizer, aborter, opts});
    } else {
      let isSchema = this.schemaTypes.includes(type);
      let prepareCreateStart = Date.now();
      let document = isInternalCard(type, documentOrStream.data && documentOrStream.data.id) && writer.hasCardSupport ?
        this._cleanupCardData(schema, documentOrStream) :
        this._cleanupBodyData(schema, documentOrStream.data);
      if (!indexOnly) {
        let opts = await writer.prepareCreate(
          session,
          type,
          document,
          isSchema
        );
        let { originalDocument, finalDocument, finalizer, aborter } = opts;
        pending = await this.createPendingChange({ type, originalDocument, finalDocument, finalizer, aborter, schema, context, opts});
      } else {
        pending = await this.createPendingChange({ type, finalDocument: document, schema, context });
      }
      performanceLog.debug(`create ${type}/${documentOrStream.data ? documentOrStream.data.id : 'not-defined'} time to complete writer.prepareCreate: ${Date.now() - prepareCreateStart}ms`);
    }

    try {
      let newSchema = await schema.validate(pending, { type, session });
      schema = newSchema || schema;

      if (typeof beforeFinalize === 'function') {
        let beforeFinalizeStart = Date.now();
        await beforeFinalize(schema);
        performanceLog.debug(`create ${type}/${documentOrStream.data ? documentOrStream.data.id : 'not-defined'} time to complete beforeFinalize work (create/update card schema resources): ${Date.now() - beforeFinalizeStart}ms`);
      }

      if (!indexOnly) {
        let finalizeStart = Date.now();
        context = await this._finalize(pending, type, schema, sourceId);
        performanceLog.debug(`create ${type}/${documentOrStream.data ? documentOrStream.data.id : 'not-defined'} time to complete finalize: ${Date.now() - finalizeStart}ms`);
      } else {
        context = pending.finalDocumentContext;
      }

      let batch = this.pgSearchClient.beginBatch(schema, this.searchers);
      let indexSaveStart = Date.now();
      await batch.saveDocument(context);
      performanceLog.debug(`create ${type}/${documentOrStream.data ? documentOrStream.data.id : 'not-defined'} time to complete index save: ${Date.now() - indexSaveStart}ms`);
      let invalidateStart = Date.now();
      await batch.done();
      performanceLog.debug(`create ${type}/${documentOrStream.data ? documentOrStream.data.id : 'not-defined'} time to complete index invalidation: ${Date.now() - invalidateStart}ms`);

      if (newSchema) {
        this.currentSchema.invalidateCache();
      }
    } finally {
      if (pending) { await pending.abort();  }
    }

    let readAuthStart = Date.now();
    let authorizedDocument = await context.applyReadAuthorization({ session });
    performanceLog.debug(`create ${type}/${documentOrStream.data ? documentOrStream.data.id : 'not-defined'} time to complete read auth: ${Date.now() - readAuthStart}ms`);

    if (isInternalCard(authorizedDocument.data.type, authorizedDocument.data.id)) {
      let adaptStart = Date.now();
      let card = await adaptCardToFormat(schema, session, authorizedDocument, 'isolated', this.searchers);
      performanceLog.debug(`create ${type}/${documentOrStream.data.id} time to complete adapting card to format: ${Date.now() - adaptStart}ms`);
      performanceLog.debug(`create ${type}/${documentOrStream.data.id} total time to create document: ${Date.now() - handleCreateStart}ms`);
      return card;
    }
    performanceLog.debug(`create ${type}/${documentOrStream.data ? documentOrStream.data.id : 'not-defined'} total time to create document: ${Date.now() - handleCreateStart}ms`);
    return authorizedDocument;
  }

  // TODO add timing logs
  async update(session, type, id, document, schema, indexOnly) {
    let updateStart = Date.now();
    log.info("updating type=%s id=%s", type, id);
    if (!document.data) {
      throw new Error('The document must have a top-level "data" property', {
        status: 400
      });
    }
    await this.pgSearchClient.ensureDatabaseSetup();
    schema = schema || await this.currentSchema.getSchema();

    let beforeFinalize, afterFinalize, context;
    if (type === 'cards') {
      let handleCardOperationsStart = Date.now();
      ({ schema, context, internalCard:document, beforeFinalize, afterFinalize } = await this.handleCardOperations(session, document));
      type = document.data.type;
      performanceLog.debug(`update ${type}/${document.data.id} time to complete handleCardOperations: ${Date.now() - handleCardOperationsStart}ms`);
    }

    let { writer, sourceId } = await this._getSchemaDetailsForType(schema, type, id, document);
    if (isInternalCard(type, id) && !writer.hasCardSupport) {
      let source = schema.getDataSource(sourceId);
      throw new Error(`The configured writer for cards documents, 'data-sources/${sourceId}' (source type '${source.sourceType}'), does not have card support`);
    }

    let pending;
    let isSchema = this.schemaTypes.includes(type);
    let prepareUpdateStart = Date.now();
    let cleanDocument = isInternalCard(type, document.data && document.data.id) && writer.hasCardSupport ?
      this._cleanupCardData(schema, document) :
      this._cleanupBodyData(schema, document.data);
    if (!indexOnly) {
      let opts = await writer.prepareUpdate(
        session,
        type,
        id,
        cleanDocument,
        isSchema,
      );
      let { originalDocument, finalDocument, finalizer, aborter } = opts;
      pending = await this.createPendingChange({ type, originalDocument, finalDocument, finalizer, aborter, schema, context, opts });
    } else {
      pending = await this.createPendingChange({ type, finalDocument: cleanDocument, schema, context });
    }
    performanceLog.debug(`update ${type}/${document.data.id} time to complete writer.prepareUpdate: ${Date.now() - prepareUpdateStart}ms`);

    try {
      let newSchema = await schema.validate(pending, { type, id, session });
      schema = newSchema || schema;

      if (typeof beforeFinalize === 'function') {
        let beforeFinalizeStart = Date.now();
        await beforeFinalize(schema);
        performanceLog.debug(`update ${type}/${document.data.id} time to complete beforeFinalize work (create/update card schema resources): ${Date.now() - beforeFinalizeStart}ms`);
      }
      if (!indexOnly) {
        let finalizeStart = Date.now();
        context = await this._finalize(pending, type, schema, sourceId);
        performanceLog.debug(`update ${type}/${document.data.id} time to complete finalize: ${Date.now() - finalizeStart}ms`);
      } else {
        context = pending.finalDocumentContext;
      }

      let batch = this.pgSearchClient.beginBatch(schema, this.searchers);
      let indexSaveStart = Date.now();
      await batch.saveDocument(context);
      performanceLog.debug(`update ${type}/${document.data.id} time to complete index save: ${Date.now() - indexSaveStart}ms`);
      let invalidateStart = Date.now();
      await batch.done();
      performanceLog.debug(`update ${type}/${document.data.id} time to complete index invalidation: ${Date.now() - invalidateStart}ms`);

      if (typeof afterFinalize === 'function') {
        let afterFinalizeStart = Date.now();
        schema = await afterFinalize(pending.originalDocumentContext.schema, schema);
        performanceLog.debug(`update ${type}/${document.data.id} time to complete afterFinalize work (delete card schema resources): ${Date.now() - afterFinalizeStart}ms`);
      }
      if (newSchema) {
        this.currentSchema.invalidateCache();
      }
    } finally {
      if (pending) { await pending.abort();  }
    }

    let readAuthStart = Date.now();
    let authorizedDocument = await context.applyReadAuthorization({ session });
    performanceLog.debug(`update ${type}/${document.data.id} time to complete read auth: ${Date.now() - readAuthStart}ms`);

    if (isInternalCard(authorizedDocument.data.type, authorizedDocument.data.id)) {
      let adaptStart = Date.now();
      let card = await adaptCardToFormat(schema, session, authorizedDocument, 'isolated', this.searchers);
      performanceLog.debug(`update ${type}/${document.data.id} time to complete adapting card to format: ${Date.now() - adaptStart}ms`);
      performanceLog.debug(`update ${type}/${document.data.id} total time to update document: ${Date.now() - updateStart}ms`);
      return card;
    }
    performanceLog.debug(`update ${type}/${document.data.id} total time to update document: ${Date.now() - updateStart}ms`);
    return authorizedDocument;
  }

  // TODO add timing logs
  async delete(session, version, type, id, schema, indexOnly) {
    let deleteStart = Date.now();
    log.info("deleting type=%s id=%s", type, id);
    await this.pgSearchClient.ensureDatabaseSetup();

    schema = schema || await this.currentSchema.getSchema();

    let afterFinalize, context, internalCard;
    if (type === 'cards') {
      let handleCardOperationsStart = Date.now();
      ({ schema, context, internalCard, afterFinalize } = await this.handleCardDeleteOperation(session, id));
      if (!internalCard) { return; }
      type = internalCard.data.type;
      version = get(internalCard, 'data.meta.version');
      performanceLog.debug(`delete ${type}/${id} time to complete handleCardOperations: ${Date.now() - handleCardOperationsStart}ms`);
    }

    let { writer, sourceId } = await this._getSchemaDetailsForType(schema, type, id, internalCard);
    if (isInternalCard(type, id) && !writer.hasCardSupport) {
      let source = schema.getDataSource(sourceId);
      throw new Error(`The configured writer for cards documents, 'data-sources/${sourceId}' (source type '${source.sourceType}'), does not have card support`);
    }

    let pending;
    let isSchema = this.schemaTypes.includes(type);
    let prepareDeleteStart = Date.now();
    if (!indexOnly) {  
      let opts = await writer.prepareDelete(session, version, type, id, isSchema, indexOnly);
      let { originalDocument, finalDocument, finalizer, aborter } = opts;
      pending = await this.createPendingChange({ type, originalDocument, finalDocument, finalizer, aborter, schema, context, opts });
    } else {
      pending = await this.createPendingChange({ type, schema, context });
    }
    performanceLog.debug(`delete ${type}/${id} time to complete writer.prepareDelete: ${Date.now() - prepareDeleteStart}ms`);

    let newSchema;
    try {
      if (!indexOnly) {
        newSchema = await schema.validate(pending, { session });
        schema = newSchema || schema;
        let finalizeStart = Date.now();
        context = await this._finalize(pending, type, schema, sourceId, id);
        performanceLog.debug(`delete ${type}/${id} time to complete finalize: ${Date.now() - finalizeStart}ms`);
      } else {
        context = this.searchers.createDocumentContext({
          id,
          type,
          schema,
          sourceId,
          upstreamDoc: null
        });
      }

      let batch = this.pgSearchClient.beginBatch(schema, this.searchers);
      let indexDeleteStart = Date.now();
      await batch.deleteDocument(context);
      performanceLog.debug(`delete ${type}/${id} time to complete index delete: ${Date.now() - indexDeleteStart}ms`);
      let invalidateStart = Date.now();
      await batch.done();
      performanceLog.debug(`delete ${type}/${id} time to complete index invalidation: ${Date.now() - invalidateStart}ms`);

      if (typeof afterFinalize === 'function') {
        schema = await afterFinalize(get(pending, 'originalDocumentContext.schema'), schema);
      }
      if (newSchema) {
        this.currentSchema.invalidateCache();
      }
      performanceLog.debug(`delete ${type}/${id} total time to delete document: ${Date.now() - deleteStart}ms`);
    } finally {
      if (pending) { await pending.abort();  }
    }
  }

  async createPendingChange({ type, originalDocument, finalDocument, finalizer, aborter, schema, context, opts }) {
    schema = schema || await this.currentSchema.getSchema();
    let contentType = schema.getType(type);
    let sourceId;
    if (contentType) {
      sourceId = get(contentType, 'dataSource.id');
    }

    return new PendingChange({
      originalDocument,
      finalDocument,
      finalizer,
      aborter,
      sourceId,
      schema,
      context,
      opts,
      searchers: this.searchers,
    });
  }

  async _finalize(pending, type, schema, sourceId, id) {
    let meta = await pending.finalize();
    let { finalDocumentContext } = pending;

    if (finalDocumentContext) {
      await finalDocumentContext.updateDocumentMeta(meta);
      return finalDocumentContext;
    }

    // This is the scenario where the document is being deleted
    return this.searchers.createDocumentContext({
      id,
      type,
      schema,
      sourceId,
      upstreamDoc: null
    });
  }

  // if any primary card models are included in the deletedResources when we'll
  // update the schema to remove those card model's content types. But the onus
  // will be on the caller to delete the primary card model--which is the signal
  // to the hub to delete the externally facing card itself.
  async _deleteInternalCardResources(session, schema, deletedResources) {
    if (!deletedResources.length) { return schema; }

    let [ modelsToDelete, schemaToDelete] = partition(deletedResources, i => getCardId(i.type));
    let [ cardModels, internalModels ] = partition(modelsToDelete, i => isInternalCard(i.type, i.id));
    // TODO can we run all these concurrently?
    for (let resource of internalModels) {
      await this.delete(session, resource.meta.version, resource.type, resource.id, schema, true);
    }
    let fieldsWithRelatedTypes = schemaToDelete.filter(i => i.type === 'fields' && (get(i, 'relationships.related-types.data.length') || 0) > 0);
    // remove any related types so we wont be tripped up by deleting an internal card
    // content type that has a field with an internal card related type
    // TODO can we run all these concurrently?
    for (let resource of fieldsWithRelatedTypes) {
      set(resource, 'relationships.related-types.data', []);
      let { data: updatedResource } = await this.update(session, resource.type, resource.id, { data: resource }, schema, true);
      let index = schemaToDelete.findIndex(i => `${i.type}/${i.id}` === `${resource.type}/${resource.id}`);
      schemaToDelete[index] = updatedResource;
    }

    if (cardModels.length) {
      schema = await schema.applyChanges(cardModels.map(i => ({ type: 'content-types', id: i.id, document: null })));
    }
    schemaToDelete.sort(sortSchemaForDelete);
    // TODO can we run all these concurrently?
    for (let resource of schemaToDelete) {
      await this.delete(session, resource.meta.version, resource.type, resource.id, schema, true);
    }

    return schema;
  }

  async _loadInternalCardSchema(internalOrExternalCard) {
    let isInternal = isInternalCard(internalOrExternalCard.data.type, internalOrExternalCard.data.id);
    let id = internalOrExternalCard.data.id;
    // The act of deriving a schema may require reads in order to derive the schema
    // the card. These reads are signals that there are a resource dependencies
    // we need to keep track of in order to support invalidations correctly.
    // In this scenario, we'll create a DocumentContext to handle these reads that we'll
    // then pass into the finalizers to leverage for all the downstream stuff.
    let context = this.searchers.createDocumentContext({
      id,
      type: id,
      schema: await this.currentSchema.getSchema(),
      upstreamDoc: isInternal ?
        internalOrExternalCard :
        // just a placeholder while we use the context's getCard to generate the actual upstream doc
        { data: { type: id, id } }
    });
    let internalCard;
    if (isInternal) {
      internalCard = internalOrExternalCard;
    } else {
      internalCard = await generateInternalCardFormat(
        await this.currentSchema.getSchema(),
        internalOrExternalCard,
        context.getCard.bind(context)
      );
      context.upstreamDoc = internalCard;
      context.suppliedIncluded = internalCard.included || [];
    }
    let schema = await loadCard(await this.currentSchema.getSchema(), internalCard, context.getCard.bind(context));
    return { internalCard, context, schema: await (await this.currentSchema.getSchema()).applyChanges(schema.map(document => ({ id: document.id, type: document.type, document }))) };
  }

  // TODO this service should be moved into the schema
  async _getSchemaDetailsForType(schema, type, id, internalCard) {
    let dataSource;
    let getInternalCard = async function(cardId) {
      let card;
      try {
        card = await this.searchers.get(Session.INTERNAL_PRIVILEGED, 'local-hub', cardId, cardId);
      } catch (err) {
        if (err.status !== 404) { throw err; }
      }
      return card;
    };

    if (isInternalCard(type, id) && internalCard) {
      let dataSources = [...schema.getDataSources().values()];
      // chain is ordered with the closest ancestor first, and the most remote ancestor last
      // crawl the chain looking for the data source of the most direct ancestor of the card
      let chain = (await adoptionChain(internalCard, getInternalCard.bind(this))).map(i => i.data.id);
      for (let cardType of chain) {
        dataSource = dataSources.find(i => Array.isArray(i.cardTypes) && i.cardTypes.includes(cardType));
        if (dataSource) { break; }
      }
    }

    if (!dataSource) {
      ({ dataSource } = schema.getType(type) || {});
    }

    if (!dataSource || !dataSource.writer) {
      throw new Error(`"${type}" is not a writable type`, {
        status: 403,
        title: "Not a writable type"
      });
    }

    let writer = dataSource.writer;
    let sourceId = dataSource.id;
    return { writer, sourceId };
  }

  _cleanupBodyData(schema, data) {
    let doc = schema.withOnlyRealFields(data);  // remove computed fields
    return this._createQueryLinks(doc);         // convert `cardstack-queries` relationships to links.related
  }

  _cleanupCardData(schema, card) {
    let meta = get(card, 'data.meta');
    let cardResource = schema.withOnlyRealFields(card.data);  // remove computed fields
    card.data = cardResource;
    if (meta) {
      card.data.meta = meta;
    }
    return card;
  }

  _createQueryLinks(doc) {
    if (!doc.relationships) {
      return doc;
    }

    let activeDoc = doc;

    for (let fieldName of Object.keys(doc.relationships)) {
      let relationshipData = doc.relationships[fieldName] && doc.relationships[fieldName].data;

      if ( relationshipData &&
        ((relationshipData.length && relationshipData[0].type === 'cardstack-queries') ||
        relationshipData.type === 'cardstack-queries')
      ) {
        if (activeDoc === doc) {
          activeDoc = Object.assign({}, doc);
        }
        if (activeDoc.relationships === doc.relationships) {
          activeDoc.relationships = Object.assign({}, doc.relationships);
        }
        activeDoc.relationships[fieldName].links = {
          related: Array.isArray(relationshipData) ? relationshipData[0].id : relationshipData.id
        };
        delete activeDoc.relationships[fieldName].data;
      }
    }

    return activeDoc;
  }
});

class PendingChange {
  constructor({
    originalDocument,
    finalDocument,
    finalizer,
    aborter,
    searchers,
    sourceId,
    schema,
    context,
    opts={}
  }) {
    if (!searchers || !schema) {
      throw new Error(`PendingChange requires 'searchers' and 'schema' arguments.`);
    }

    this.originalDocument = originalDocument;
    this.finalDocument = finalDocument;
    this.serverProvidedValues = new Map();
    this._finalizer = finalizer;
    this._aborter = aborter;

    if (schema && searchers) {
      if (originalDocument) {
        this.originalDocumentContext = !finalDocument && context ? opts.context : searchers.createDocumentContext({
          type: originalDocument.type,
          schema,
          sourceId,
          id: originalDocument.id,
          upstreamDoc: originalDocument ? { data: originalDocument } : null,
        });
      }
      if (finalDocument) {
        this.finalDocumentContext = context || searchers.createDocumentContext({
          type: finalDocument.type,
          schema,
          sourceId,
          id: finalDocument.id,
          upstreamDoc: finalDocument ? { data: finalDocument } : null,
        });
      }
    }

    for (let prop of Object.keys(opts)) {
      if (this[prop] != null) { continue; }
      this[prop] = opts[prop];
    }
  }

  async finalize() {
    let finalizer = this._finalizer;
    this._finalizer = null;
    this._aborter = null;
    if (finalizer) {
      return finalizer.call(null, this);
    }
  }

  async abort() {
    let aborter = this._aborter;
    this._finalizer = null;
    this._aborter = null;
    if (aborter) {
      return aborter.call(null, this);
    }
  }
}

// TODO Probably a better idea would be to refactor JSONAPIFactory to outside of test-support
// and then use that to get the resources ordered by dependency in order to safely delete.
function sortSchemaForDelete({ type:typeA }, { type:typeB }) {
  if (typeA === 'computed-fields') {
    typeA = 'fields';
  }
  if (typeB === 'computed-fields') {
    typeB = 'fields';
  }

  if (typeA === 'content-types' && typeB === 'fields') {
    return -1;
  }
  if (typeA === 'fields' && typeB === 'content-types') {
    return 1;
  }
  return 0;
}