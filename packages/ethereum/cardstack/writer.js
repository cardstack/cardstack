const Error = require('@cardstack/plugin-utils/error');
const PendingChange = require('@cardstack/plugin-utils/pending-change');
const { declareInjections } = require('@cardstack/di');
const Session = require('@cardstack/plugin-utils/session');
const { get } = require('lodash');

const pendingChanges = new WeakMap();

module.exports = declareInjections({
  indexers: 'hub:indexers',
  controllingBranch: 'hub:controlling-branch',
  writers: 'hub:writers',
  searchers: 'hub:searchers',
  transactionIndexer: `plugin-services:${require.resolve('./transaction-indexer')}`
}, class TrackedEthereumAddressWriter {

  async prepareCreate(branch, session, type, document) {
    let proxiedDocument = await this._getProxiedDocument(branch, type, document);
    let pending = new PendingChange(null, document, finalizer);

    await this.writers.create(branch, Session.INTERNAL_PRIVILEGED, 'proxied-tracked-ethereum-addresses', proxiedDocument);
    pendingChanges.set(pending, { proxiedDocument, transactionIndexer: this.transactionIndexer });

    return pending;
  }

  async prepareUpdate(branch, session, type, id) {
    throw new Error(`Tracked ethereum addresses '${type/id}' cannot be updated (only created or deleted).`);
  }

  async prepareDelete(branch, session, version, type, id) {
    let { data: { type:proxiedType } } = await this._getProxiedDocument(branch, type, null, id);
    let { data:document } = await this.searchers.getFromControllingBranch(Session.INTERNAL_PRIVILEGED, type, id);
    let proxiedDocument = await this.searchers.getFromControllingBranch(Session.INTERNAL_PRIVILEGED, proxiedType, id);
    let proxiedVersion = get(proxiedDocument, 'data.meta.version');
    await this.writers.delete(branch, Session.INTERNAL_PRIVILEGED, proxiedVersion, 'proxied-tracked-ethereum-addresses', id);

    let pending = new PendingChange(document, null, finalizer);
    pendingChanges.set(pending, { proxiedDocument, transactionIndexer: this.transactionIndexer });
    return pending;
  }

  async _getProxiedDocument(branch, type, document, id) {
    if (branch !== this.controllingBranch.name) {
      throw new Error(`Tracked ethereum addresses is only supported on the '${this.controllingBranch.name}' branch.`);
    }
    if (type !== 'tracked-ethereum-addresses') {
      throw new Error(`The type '${type}' is not writable.`);
    }

    let proxiedId = document ? document.id : id;

    return { data: { id: proxiedId, type: 'proxied-tracked-ethereum-addresses'} };
  }
});

async function finalizer(pendingChange) {
  let { proxiedDocument, transactionIndexer } = pendingChanges.get(pendingChange);

  let { data: { id: address } } = proxiedDocument;
  let proxiedVersion = get(proxiedDocument, 'data.meta.version');

  if (proxiedVersion) {
    await transactionIndexer.index({ stopIndexingAddress: address }); // it's ok to await this one, as it should be pretty immediate
  } else {
    // Don't await the indexing, as indexing could take awhile.
    // Make sure to use TransactionIndexer._indexingPromise in the tests so async doesn't leak
    transactionIndexer.index({ startIndexingAddress: address });
    return { version: 1 };
  }
}
