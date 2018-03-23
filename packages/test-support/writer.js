const { get } = require('lodash');
const Error = require('@cardstack/plugin-utils/error');
const { declareInjections } = require('@cardstack/di');

module.exports = declareInjections({
  sources: 'hub:data-sources',
  searchers: 'hub:searchers'
}, class TestSupportWriter {

  async _getWriter(sourceId) {
    let activeSources = await this.sources.active();
    let source = activeSources.get(sourceId);

    if (!source) { return; }

    return source.writer;
  }

  async prepareCreate(branch, session, type, document, isSchema) {
    let sourceId = get(document, 'relationships.checkpoint-data-source.data.id');
    if (!sourceId) {
      throw new Error(`${type} did not specify a checkpoint-data-source relationship`, { status: 400 });
    }

    let writer = await this._getWriter(sourceId);
    if (!writer) {
      throw new Error(`Could not find writer for type ${type} that uses data source ${sourceId}`, { status: 400 });
    }

    if (type === 'checkpoints') {
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
});
