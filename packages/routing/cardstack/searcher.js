module.exports = class SpacesSearcher {
  static create(...args) {
    return new this(...args);
  }
  constructor(opts) {
    let { dataSource } = opts;
    this.dataSource = dataSource;
  }

  async get(session, branch, type, id, next) {
    if (type === 'spaces') {
      return this._getSpace(id);
    }
    return next();
  }

  // TODO search for a space by URL segment
  async search(session, branch, query, next) {
    return next();
  }

  // The initial pass of retreiving a space is to fashion a relationship
  // to a content type based on the id of the space
  _getSpace(id) {
    let [ cardType, cardId ] = id.split('/');
    if (!cardType || !cardId) {
      throw new Error(`The requested space '${cardType}/${cardId} is not valid. A card type and card ID must be supplied`, { status: 400 });
    }

    return {
      data: {
        id,
        type: 'spaces',
        attributes: { 'url-segment': `/${cardType}/${cardId}` },
        relationships: {
          'primary-card': {
            data: { type: cardType, id: cardId }
          }
        }
      }
    };
  }

};