const Error = require('@cardstack/plugin-utils/error');
const authLog = require('@cardstack/logger')('cardstack/auth');
const util = require('util');
const resolve = util.promisify(require('resolve'));
const bootstrapSchema = require('../bootstrap-schema');
const { get } = require('lodash');

module.exports = class DataSource {
  constructor(model, plugins, projectPath) {
    this.id = model.id;
    this.sourceType = model.attributes['source-type'];
    this._params = Object.assign({ dataSource: this }, model.attributes.params);
    this._Writer = plugins.lookupFeatureFactory('writers', this.sourceType);
    this._writer = null;
    this._Indexer = plugins.lookupFeatureFactory('indexers', this.sourceType);
    this._indexer = null;
    this._Searcher = plugins.lookupFeatureFactory('searchers', this.sourceType);
    this._searcher = null;
    this._Authenticator = plugins.lookupFeatureFactory('authenticators', this.sourceType);
    this._authenticator = null;
    this._StaticModels = plugins.lookupFeatureFactory('static-models', this.sourceType);
    this._staticModels = null;

    this._schemaContentTypes = bootstrapSchema.filter(i => i.type === 'content-types' && get(i, 'attributes.is-built-in')).map(i => i.id);
    if (!this._Writer && !this._Indexer && !this._Searcher && !this._Authenticator && !this._StaticModels) {
      throw new Error(`${this.sourceType} is either missing or does not appear to be a valid data source plugin`);
    }
    this.mayCreateUser = !!model.attributes['may-create-user'];
    this.mayUpdateUser = !!model.attributes['may-update-user'];
    if (model.attributes['user-template']) {
      throw new Error("user-template is deprecated in favor of user-rewriter");
    }
    this._userRewriter = model.attributes['user-rewriter'];
    this._userRewriterFunc = null;
    this._projectPath = projectPath;
    this._userCorrelationQuery = model.attributes['user-correlation-query'];
    this._userCorrelationQueryFunc = null;
    this.tokenExpirySeconds = model.attributes['token-expiry-seconds'] || 86400;
  }

  get writer() {
    if (!this._writer && this._Writer) {
      this._writer = this._Writer.create(this._params);
    }
    return this._writer;
  }
  get indexer() {
    if (!this._indexer && this._Indexer) {
      this._indexer = this._Indexer.create(this._params);
    }
    return this._indexer;
  }
  get searcher() {
    if (!this._searcher && this._Searcher) {
      this._searcher = this._Searcher.create(this._params);
    }
    return this._searcher;
  }
  get authenticator() {
    if (!this._authenticator && this._Authenticator) {
      this._authenticator = this._Authenticator.create(this._params);
    }
    return this._authenticator;
  }
  get staticModels() {
    if (!this._staticModels) {
      if (this._StaticModels) {
        this._staticModels = this._StaticModels.class.call(null, this._params);
      } else {
        this._staticModels = [];
      }
    }
    let schemaModels = this._staticModels.filter(i => this._schemaContentTypes.includes(i.type)).map(i => `${i.type}/${i.id}`);
    if (schemaModels.length) {
    /*
      TODO: We need to grandfather in the current static-model ability to specify schema if we want to limit this PR to
      reasoning about being able to specify the new card schema only--otherwise we'll need to also implement the new
      card indexing at the same time as well. The next step here is to remove this grandfathering so that everything uses
      the new schema feature and as a result, everything is forced to use the new card boundaries. This can be done byr
      uncommenting the line below and unskipping the unit test that goes along with this.

      throw new Error(`The datasource '${this.id}' defines static-models that includes schema. Schema is not allowed in static-models. Found schema models: ${JSON.stringify(schemaModels)}`);
    */
    }
    return this._staticModels;
  }
  async teardown() {
    if (this._writer && typeof this._writer.teardown === 'function') {
      await this._writer.teardown();
    }
    if (this._indexer && typeof this._indexer.teardown === 'function') {
      await this._indexer.teardown();
    }
    if (this._searcher && typeof this._searcher.teardown === 'function') {
      await this._searcher.teardown();
    }
    if (this._authenticator && typeof this._authenticator.teardown === 'function') {
      await this._authenticator.teardown();
    }
  }

  async rewriteExternalUser(externalUser) {
    if (!this._userRewriterFunc) {
      if (this._userRewriter) {
        this._userRewriterFunc = require(await resolve(this._userRewriter, { basedir: this._projectPath }));
      } else if (this.authenticator.defaultUserRewriter) {
        this._userRewriterFunc = this.authenticator.defaultUserRewriter.bind(this.authenticator);
      } else {
        this._userRewriterFunc = (externalUser) => Object.assign({}, externalUser);
      }
    }
    authLog.debug("external user %j", externalUser);
    let rewritten = this._userRewriterFunc(externalUser);
    authLog.debug("rewritten user %j", rewritten);
    return rewritten;
  }

  async externalUserCorrelationQuery(externalUser) {
    if (!this._userCorrelationQueryFunc) {
      if (this._userCorrelationQuery) {
        this._userCorrelationQueryFunc = require(await resolve(this._userCorrelationQuery, { basedir: this._projectPath }));
      } else {
        this._userCorrelationQueryFunc = () => null;
      }
    }
    return this._userCorrelationQueryFunc(externalUser);
  }
};