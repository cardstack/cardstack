const log = require('@cardstack/logger')('cardstack/routers');
const { declareInjections } = require('@cardstack/di');
const Error = require('@cardstack/plugin-utils/error');
const Session = require('@cardstack/plugin-utils/session');
const { getRoute, getRouter, getDefaultRouter } = require('@cardstack/routing/cardstack/router-utils');
const { get } = require('lodash');

const maxRoutingRecursion = 50;
const notFoundErrorCardId = 'not-found';

module.exports = declareInjections({
  plugins: 'hub:plugins',
  currentSchema: 'hub:current-schema',
  searchers: 'hub:searchers',
},

class Routers {
  async getSpace(branch, path) {
    let schema = await this.currentSchema.forBranch(branch);
    let plugins = await this.plugins.active();

    return this._recurseThruSpaces({ plugins, schema, branch, originalPath: path, remainingPath: path });
  }

  async _getApplicationCard(branch) {
    let id, type, config;
    try {
      config = (await this.searchers.get(Session.INTERNAL_PRIVILEGED, branch, 'plugin-configs', '@cardstack/hub')).data;
    } catch (err) {
      if (err.status !== 404) { throw err; }
    }

    if (config) {
      id = get(config, 'attributes.plugin-config.application-card.id');
      type = get(config, 'attributes.plugin-config.application-card.type');
    }

    if (id && type) {
      let appCard = await this.searchers.get(Session.INTERNAL_PRIVILEGED, branch, type, id);
      if (appCard) {
        return appCard;
      }
    }

    return { data: { type: 'application-cards', id: 'getting-started' } };
  }

  async _getErrorCard(schema, typeStack, errorCardId) {
    for (let type of typeStack) {
      let errorType = `${type}-errors`;
      let errorContentType = schema.types.get(errorType);
      if (errorContentType) {
        // we check that the error card has an open grant, otherwise revert to system error card
        // we dont want to potentially swallow errors due to restrive grant settings, so err on the side of caution
        if (!errorContentType.authorizedReadRealms().includes('groups/everyone')) {
          log.warn(`The error card content-type '${errorType}' does not have a read grant for groups/everyone. Not using this error card.`);
        } else {
          let errorCard;
          try {
            errorCard = await this.searchers.getFromControllingBranch(Session.INTERNAL_PRIVILEGED, errorType, errorCardId);
          } catch (err) {
            if (err.status !== 404) { throw err; }
          }

          if (errorCard) {
            errorCard = errorCard.data;
            errorCard.meta = errorCard.meta || {};
            errorCard.meta['is-error-card'] = true;

            return errorCard;
          } else {
            log.warn(`The error card ${errorType}/${errorCardId} does not exist.`);
          }
        }
      }
    }
    return {
      type: 'error-cards', id: errorCardId,
      meta: { 'is-error-card': true }
    };
  }

  async _getNotFoundErrorCard(schema, typeStack) {
    return { data: await this._getErrorCard(schema, typeStack, notFoundErrorCardId) };
  }

  async _recurseThruSpaces({ plugins, schema, branch, originalPath, cardContext, remainingPath, typeStack=[], count=0 }) {
    if (count > maxRoutingRecursion) {
      throw new Error(`The space for path '${originalPath}' could not be resolved after ${maxRoutingRecursion} routing attempts.`);
    }

    let routingCard = cardContext = cardContext || await this._getApplicationCard(branch);
    typeStack.unshift(cardContext.data.type);
    let router = await getRouter(plugins, schema, cardContext);

    let usingDefaultRouter;
    if (!router && count === 0) {
      usingDefaultRouter = true;
      router = await getDefaultRouter(plugins, cardContext);
    } else if (!router) {
      cardContext = await this._getNotFoundErrorCard(schema, typeStack);
    }

    let updatedRemainingPath = remainingPath;
    if (router) {
      let route = getRoute(router, remainingPath, cardContext.data.type);
      if (!route) {
        cardContext = await this._getNotFoundErrorCard(schema, typeStack);
      } else {
        updatedRemainingPath = route.remainingPath;
        let { data: cards, included } = await this.searchers.search(Session.INTERNAL_PRIVILEGED, branch, route.query);

        if (!cards || !cards.length) {
          cardContext = await this._getNotFoundErrorCard(schema, typeStack);
        } else {
          cardContext = { data: cards[0], included };
          if (updatedRemainingPath && updatedRemainingPath.charAt(0) === '/') {
            return await this._recurseThruSpaces({ plugins, schema, branch, originalPath, cardContext, remainingPath: updatedRemainingPath, typeStack, count: count + 1 });
           }
        }
      }
    }

    if (get(cardContext, 'data.meta.is-error-card')) {
      // regurgitate the consumed path, as you were not able to resolve the path after all
      updatedRemainingPath = '';
    }

    let consumedPath = originalPath.replace(updatedRemainingPath, '');
    let included = [ cardContext.data ].concat(cardContext.included || []);

    let meta = {
      'routing-card': { data: { type: routingCard.data.type, id: routingCard.data.id } }
    };
    if (usingDefaultRouter) {
      meta['using-default-router'] = true;
    }

    return {
      data: {
        id: consumedPath,
        type: 'spaces',
        attributes: {
          'query-params': updatedRemainingPath
        },
        relationships: {
          'primary-card': {
            data: { type: cardContext.data.type, id: cardContext.data.id }
          }
        },
      },
      meta,
      included
    };
  }

});