const { get } = require('lodash');
const log = require('@cardstack/logger')('cardstack/test-support');
const Error = require('@cardstack/plugin-utils/error');
const { declareInjections } = require('@cardstack/di');
const PendingChange = require('@cardstack/plugin-utils/pending-change');

const seedsCheckpointId = 'seeds';

module.exports = declareInjections({
  sources: 'hub:data-sources',
  searchers: 'hub:searchers',
  writers: 'hub:writers',
  indexers: 'hub:indexers',
  seeds: 'config:initial-models'
}, class TestSupportWriter {

  async _getWriter(sourceId) {
    let activeSources = await this.sources.active();
    let source = activeSources.get(sourceId);

    if (!source) { return; }

    return source.writer;
  }

  async prepareCreate(branch, session, type, document, isSchema) {
    let relatedCheckpointId = get(document, 'relationships.checkpoint.data.id');
    if (type === 'restores' && relatedCheckpointId === seedsCheckpointId) {
      return this._prepareSeedsCheckpoint(branch, session, type, document);
    }

    let sourceId = get(document, 'relationships.checkpoint-data-source.data.id');
    if (!sourceId) {
      throw new Error(`${type} did not specify a checkpoint-data-source relationship`, { status: 400 });
    }

    let writer = await this._getWriter(sourceId);
    if (!writer) {
      throw new Error(`Could not find writer for type ${type} that uses data source ${sourceId}`, { status: 400 });
    }

    if (type === 'checkpoints') {
      if (document.id === seedsCheckpointId) {
        throw new Error(`The checkpoint id, '${seedsCheckpointId}', is a reserved checkpoint for loading seeds declared in the seeds folder`, { status: 400 });
      }
      if (typeof writer.prepareCreateCheckpoint !== 'function') {
        throw new Error(`The writer for type ${type} that uses data source ${sourceId} does not support 'prepareCreateCheckpoint'.`, { status: 400 });
      }
      return writer.prepareCreateCheckpoint(branch, session, type, document, isSchema);

    } else if (type === 'restores') {
      if (typeof writer.prepareApplyCheckpoint !== 'function') {
        throw new Error(`The writer for type ${type} that uses data source ${sourceId} does not support 'prepareApplyCheckpoint'.`, { status: 400 });
      }
      return writer.prepareApplyCheckpoint(branch, session, type, document, isSchema);
    }
  }

  async prepareUpdate(branch, session, type/*, id, document, isSchema*/) {
    throw new Error(`${type} may not be patched`, { status: 400 });
  }

  async prepareDelete(branch, session, version, type/*, id, isSchema*/) {
    throw new Error(`${type} may not be deleted`, { status: 400 });
  }

  async _prepareSeedsCheckpoint(branch, session, type, document) {
    let seedModels = await this.seeds();

    for (let model of seedModels) {
      let existingModel;
      try {
        existingModel = await this.searchers.get(session, branch, model.type, model.id);
      } catch (err) {
        // ignore non-existance errors
        if (err.status !== 404) { throw err; }
      }

      log.debug("loading seed model", JSON.stringify(model));

      if (!existingModel) {
        await this.writers.create(branch, session, model.type, model);
      } else {
        let { data } = existingModel;
        model.id = data.id;
        model.meta = model.meta || {};
        model.meta.version = data.meta.version;
        await this.writers.update(branch, session, model.type, data.id, model);
      }
    }
    await this.indexers.update({ forceRefresh: true });

    return new PendingChange(null, document);
  }

});
