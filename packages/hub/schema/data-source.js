const Error = require('@cardstack/plugin-utils/error');
const authLog = require('@cardstack/logger')('cardstack/auth');
const util = require('util');
const resolve = util.promisify(require('resolve'));
const bootstrapSchema = require('../bootstrap-schema');
const { get, partition } = require('lodash');
const { cardContextFromId } = require('@cardstack/plugin-utils/card-context');

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
    this._StaticSchemaModels = plugins.lookupFeatureFactory('schemas', this.sourceType);
    this._staticSchemaModels = null;
    this._schemaFeature = plugins.describeFeature('schemas', this.sourceType);

    this._schemaContentTypes = bootstrapSchema.filter(i => i.type === 'content-types' && get(i, 'attributes.is-built-in')).map(i => i.id);
    if (!this._Writer && !this._Indexer && !this._Searcher && !this._Authenticator && !this._StaticSchemaModels && !this._StaticModels) {
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
  get staticSchemaModels() {
    if (!this._staticSchemaModels) {
      let staticSchemaModels;
      if (this._StaticSchemaModels) {
        let packageName = get(this._schemaFeature, 'relationships.plugin.data.id');
        // TODO we need to replace 'local-hub' with this.id after we do the work to deal with multi-hub
        staticSchemaModels = this._StaticSchemaModels.class.call(null, Object.assign({ sourceId: 'local-hub', packageName }, this._params));
      } else {
        staticSchemaModels = [];
      }

      if (staticSchemaModels.length) {
        this._validateCardSchema(staticSchemaModels);
      }
      this._staticSchemaModels = staticSchemaModels;
    }

    return this._staticSchemaModels;
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

  _validateCardSchema(schemaModels) {
    if (!this._schemaFeature) {
      throw new Error(`Cannot validate schema for data-source ${this.id} of source-type ${this.sourceType}, no schema feature exists.`);
    }

    let nonSchemaModels = schemaModels.filter(i => !this._schemaContentTypes.includes(i.type)).map(i => `${i.type}/${i.id}`);
    if (nonSchemaModels.length) {
      throw new Error(`The datasource '${this.id}' defines schema that includes non-schema models. Non-schema models are not allowed in schemas. Found non-schema models: ${JSON.stringify(nonSchemaModels)}`);
    }

    let packageName = get(this._schemaFeature, 'relationships.plugin.data.id');
    let [ cardDefinitions, nonCardDefinitions ] = partition(schemaModels, i => i.type === 'card-definitions');

    if (!cardDefinitions.length) {
      throw new Error(`Schema for ${packageName} in datasource ${this.id} has no card-definitions model. A card-definitions model must be specified in the schema file.`);
    }
    if (cardDefinitions.length > 1) {
      throw new Error(`Schema for ${packageName} in datasource ${this.id} has more than one card-definitions model: ${JSON.stringify(cardDefinitions.map(i => `${i.type}/${i.id}`))}. There can only be one card-definitions model in the schema file.`);
    }

    // TODO we need to replace 'local-hub' with this.id after we do the work to deal with multi-hub
    let sourceId = 'local-hub';
    let [ cardDefinition ] = cardDefinitions;
    let {
      sourceId: cardDefinitionSourceId,
      packageName: cardDefinitionPackageName
    } = cardContextFromId(cardDefinition.id);
    if (sourceId !== cardDefinitionSourceId || packageName !== cardDefinitionPackageName) {
      throw new Error(`Schema for ${packageName} in datasource ${this.id} is has a card-definitions model id, '${cardDefinition.id}', that is not scoped for this source::package, "${sourceId}::${packageName}".`);
    }

    let cardScopeRegex = new RegExp(`^${sourceId}::${packageName}::`);
    let unscopedModels = nonCardDefinitions.filter(i => !i.id.match(cardScopeRegex)).map(i => `${i.type}/${i.id}`);
    if (unscopedModels.length) {
      throw new Error(`Schema for ${packageName} in datasource ${this.id} has schema models that are not scoped to this data source and package ${JSON.stringify(unscopedModels)}`);
    }
  }

};
