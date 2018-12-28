const crypto = require('crypto');
const Error = require('@cardstack/plugin-utils/error');
const PendingChange = require('@cardstack/plugin-utils/pending-change');
const { declareInjections } = require('@cardstack/di');
const Session = require('@cardstack/plugin-utils/session');
const { merge, get } = require('lodash');

const pendingChanges = new WeakMap();
const proxiedTypes = ['tracked-ethereum-addresses', 'user-ethereum-addresses'];

module.exports = declareInjections({
  indexers: 'hub:indexers',
  controllingBranch: 'hub:controlling-branch',
  writers: 'hub:writers',
  searchers: 'hub:searchers',
  transactionIndexer: `plugin-services:${require.resolve('./transaction-indexer')}`
}, class EthereumWriter {

  async prepareCreate(branch, session, type, document) {
    if (type === 'user-ethereum-addresses') {
      let { data: existingUserAddress } = await this.searchers.searchFromControllingBranch(Session.INTERNAL_PRIVILEGED, {
        filter: {
          type: { exact: type },
          'address-user.id': { exact: session.id },
          'address-user.type': { exact: session.type },
        }
      });
      if (existingUserAddress.length) {
        throw new Error(`A user-ethereum-address already exists for the user ${session.type}/${session.id}: ${existingUserAddress[0].type}/${existingUserAddress[0].id}.`, { status: 403 });
      }
    }

    let proxiedDocument = await this._generateProxiedDocument(branch, type, document);
    document.id = document.id || proxiedDocument.data.id;
    let pending = new PendingChange(null, document, finalizer);

    pendingChanges.set(pending, {
      proxiedDocument,
      session,
      transactionIndexer: this.transactionIndexer,
      searchers: this.searchers,
      writers: this.writers,
      branch: this.controllingBranch.name
    });

    return pending;
  }

  async prepareUpdate(branch, session, type, id) {
    throw new Error(`'${type}/${id}' is an immutable document and cannot be updated (only created or deleted).`, { status: 403 });
  }

  async prepareDelete(branch, session, version, type, id) {
    let { data: { type:proxiedType } } = await this._generateProxiedDocument(branch, type, null, id);
    let { data:document } = await this.searchers.getFromControllingBranch(Session.INTERNAL_PRIVILEGED, type, id);
    let proxiedDocument = await this.searchers.getFromControllingBranch(Session.INTERNAL_PRIVILEGED, proxiedType, id);

    let pending = new PendingChange(document, null, finalizer);
    pendingChanges.set(pending, {
      proxiedDocument,
      session,
      transactionIndexer: this.transactionIndexer,
      searchers: this.searchers,
      writers: this.writers,
      branch: this.controllingBranch.name
    });
    return pending;
  }

  async _generateProxiedDocument(branch, type, document, id) {
    if (branch !== this.controllingBranch.name) {
      throw new Error(`${type} is only supported on the '${this.controllingBranch.name}' branch.`, { status: 403 });
    }
    if (!proxiedTypes.includes(type)) {
      throw new Error(`The type '${type}' is not writable.`, { status: 403 });
    }

    let proxiedId = (document && document.id ? document.id : id) || generateId();

    return { data: merge({}, document, { id: proxiedId, type: `proxied-${type}`}) };
  }
});

async function finalizer(pendingChange) {
  let { proxiedDocument, transactionIndexer, writers, searchers, branch, session } = pendingChanges.get(pendingChange);

  let { data: { type, id } } = proxiedDocument;
  let proxiedVersion = get(proxiedDocument, 'data.meta.version');
  let isDeleting = Boolean(proxiedVersion);

  if (isDeleting) {
    await writers.delete(branch, Session.INTERNAL_PRIVILEGED, proxiedVersion, type, id);
  } else {
    await writers.create(branch, Session.INTERNAL_PRIVILEGED, type, proxiedDocument);
  }

  if (type === 'proxied-tracked-ethereum-addresses') {
    if (isDeleting) {
      await transactionIndexer.index({ stopIndexingAddress: id }); // it's ok to await this one, as it should be pretty immediate
    } else {
      // Don't await the indexing, as indexing could take awhile.
      // Make sure to use TransactionIndexer._indexingPromise in the tests so async doesn't leak
      transactionIndexer.index({ startIndexingAddress: id });
      return { version: 1 };
    }
  } else if (type === 'proxied-user-ethereum-addresses') {
    let { data: { attributes: { 'ethereum-address': address } } } = proxiedDocument;

    if (isDeleting) {
      let { data: userAddresses } = await searchers.searchFromControllingBranch(Session.INTERNAL_PRIVILEGED, {
        filter: {
          type: { exact: 'user-ethereum-addresses' },
          'ethereum-address': { exact: address }
        }
      });

      if (!userAddresses.length ||
          userAddresses.some(i => get(i, 'relationships.address-user.data.id') !== session.id ||
                                  get(i, 'relationships.address-user.data.type') !== session.type)) { return; }

      await writers.delete(branch, Session.INTERNAL_PRIVILEGED, 1, 'tracked-ethereum-addresses', address.toLowerCase());
    } else {
      try {
        await searchers.getFromControllingBranch(Session.INTERNAL_PRIVILEGED, 'tracked-ethereum-addresses', address);
      } catch(e) {
        if (e.status !== 404) { throw e; }
        await writers.create(branch, Session.INTERNAL_PRIVILEGED, 'tracked-ethereum-addresses', {
          data: { type: 'tracked-ethereum-addresses', id: address.toLowerCase() }
        });
      }

      return { version: 1 };
    }
  }
}

function generateId() {
  return crypto.randomBytes(20).toString('hex');
}
