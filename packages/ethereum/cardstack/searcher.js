const { declareInjections } = require('@cardstack/di');
const { uniq } = require('lodash');

const aReallyLongTime = 60 * 60 * 24 * 365 * 10;

module.exports = declareInjections({
  searchers: 'hub:searchers',
  ethereumClient: `plugin-client:${require.resolve('./client')}`
},

class BlocksSearcher {
  static create(...args) {
    let [{ ethereumClient, jsonRpcUrl }] = args;
    ethereumClient.connect(jsonRpcUrl);
    return new this(...args);
  }

  constructor({ ethereumClient, jsonRpcUrl, searchers }) {
    this.searchers = searchers;
    this._jsonRpcUrl = jsonRpcUrl;
    this.ethereumClient = ethereumClient;
  }

  async get(session, branch, type, id, next) {
    let result = await next();
    if (result) {
      return result;
    }

    if (type === 'blocks') {
      return await this._getBlock(id);
    }
  }

  async search(session, branch, query, next) {
    return next();
  }

  async _getBlock(number) {
    let block = await this.ethereumClient.getBlock(number);
    if (!block) { return; }

    let addresses = block.transactions.reduce((addresses, transaction) => {
      return addresses.concat([transaction.to && transaction.to.toLowerCase(),
                               transaction.from && transaction.from.toLowerCase()]);
    }, []);
    addresses = uniq(addresses.filter(i => Boolean(i)));

    return {
      data: {
        type: 'blocks',
        id: block.number,
        attributes: {
          'block-number': block.number,
          'block-hash': block.hash,
          'timestamp': block.timestamp,
          'transaction-participants': addresses,
          'block-data': block
        }
      },
      meta: {
        'cardstack-cache-control': { 'max-age': aReallyLongTime }
      }
    };
  }
});