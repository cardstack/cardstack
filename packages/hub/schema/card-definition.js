const Error = require('@cardstack/plugin-utils/error');
const { cardDefinitionIdFromId } = require('@cardstack/plugin-utils/card-context');
const { get } = require('lodash');

module.exports = class CardDefinition {
  constructor(model, allContentTypes) {
    this.id = model.id;
    this.defaultMetadataIncludes = get(model, 'attributes.default-metadata-includes');
    //TODO probably have to build an `includesTree` like we do for ContentType's default includes

    let metadataFields = new Map();
    let embeddedMetadataFields = new Map();

    let modelContentTypeId = get(model, 'relationships.model.data.id');
    if (!modelContentTypeId || get(model, 'relationships.model.data.type') !== 'content-types') {
      throw new Error(`The card-definition '${model.id}' does not define a model content-type.`);
    }

    if (cardDefinitionIdFromId(modelContentTypeId) !== model.id) {
      throw new Error(`The content-type '${modelContentTypeId}' for the model of the card-definition '${model.id}' is outside of this card-definition's scope.`);
    }

    let contentType = allContentTypes.get(modelContentTypeId);
    if (!contentType) {
      throw new Error(`The content-type '${modelContentTypeId}' that is used for the model of the card-definition '${model.id}' does not exist.`);
    }
    this.modelContentType = contentType;

    for (let field of this.modelContentType.realAndComputedFields.values()) {
      if (!field.isMetadata) { continue; }

      metadataFields.set(field.name, field);
      if (field.neededWhenEmbedded) {
        embeddedMetadataFields.set(field.name, field);
      }
    }

    this.metadataFields = metadataFields;
    this.embeddedMetadataFields = embeddedMetadataFields;
  }
};