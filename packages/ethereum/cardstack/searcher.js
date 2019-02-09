const { declareInjections } = require('@cardstack/di');
const { get } = require('lodash');

module.exports = declareInjections({
  transactionIndex: `plugin-client:${require.resolve('./transaction-index')}`
},
class TransactionSearcher {
  static create(...args) {
    return new this(...args);
  }

  constructor({ transactionIndex }) {
    this.transactionIndex = transactionIndex;
  }

  async get(session, branch, type, id, next) {
    if (type === 'ethereum-transactions') {
      return await this._getTransaction(id);
    }
    return await next();
  }

  // This is currently only handling queries where an address
  // is on both sides of the transaction, like this:
  // {
  //   filter: {
  //     or: [{
  //       type: 'ethereum-transactions',
  //       'transaction-to': address
  //     },{
  //       type: 'ethereum-transactions',
  //       'transaction-from': address
  //     }]
  //   }
  // }
  async search(session, branch, query, next) {
    if (Array.isArray(get(query, 'filter.or')) &&
      query.filter.or.every(i => get(i, 'type.exact') === 'ethereum-transactions' ||
                                 get(i, 'type') === 'ethereum-transactions')) {
      return await this._queryTransactions(query);
    }
    return next();
  }

  async _getTransaction(txnHash) {
    let txn = await this.transactionIndex.getTransaction(txnHash);
    if (!txn) { return; }

    return { data: rawTransactionToResource(txn) };
  }

  async _queryTransactions(query) {
    let orClause = get(query, 'filter.or[0]'); // assumes all OR clauses are identical except the 'transaction-to'/'transaction-from' clause
    let address = get(orClause, 'transaction-from.exact') ||
                  get(orClause, 'transaction-from') ||
                  get(orClause, 'transaction-to.exact') ||
                  get(orClause, 'transaction-to');
    let sinceBlockNumber;
    if (get(orClause, 'block-number.range.gt') != null) {
      sinceBlockNumber = get(orClause, 'block-number.range.gt') + 1;
    } else if (get(orClause, 'block-number.range.gte') != null) {
      sinceBlockNumber = get(orClause, 'block-number.range.gte');
    }

    let toBlockNumber;
    if (get(orClause, 'block-number.range.lt') != null) {
      toBlockNumber = get(orClause, 'block-number.range.lt') - 1;
    } else if (get(orClause, 'block-number.range.lte') != null) {
      toBlockNumber = get(orClause, 'block-number.range.lte');
    }

    let txns = await this.transactionIndex.getTransactionsForAddress(address, { sinceBlockNumber, toBlockNumber });
    if (!txns) { return { data: [] }; }

    return { data: txns.map(t => rawTransactionToResource(t)) };
  }
});

function rawTransactionToResource({
  transaction_hash,
  block_hash,
  block_number,
  from_address,
  to_address,
  transaction_value,
  timestamp,
  transaction_nonce,
  transaction_index,
  gas,
  gas_price,
  gas_used,
  cumulative_gas_used,
  transaction_successful
}) {
  let result = {
    id: transaction_hash,
    type: 'ethereum-transactions',
    attributes: {
      'transaction-hash': transaction_hash,
      'block-hash': block_hash,
      'block-number': block_number,
      'transaction-to': to_address ? to_address.toLowerCase() : null,
      'transaction-from': from_address.toLowerCase(),
      'transaction-value': transaction_value,
      'transaction-nonce': transaction_nonce,
      'transaction-index': transaction_index,
      'gas-price': gas_price,
      'gas-used': gas_used,
      'cumulative-gas-used': cumulative_gas_used,
      'transaction-successful': transaction_successful,
      timestamp,
      gas,
    },
    relationships: {
      'from-address': {
        data: { type: 'ethereum-addresses', id: from_address.toLowerCase() }
      },
      'to-address': {
        data: null
      }

    }
  };

  if (to_address) {
    result.relationships['to-address'].data = { type: 'ethereum-addresses', id: to_address.toLowerCase() };
  }

  return result;
}