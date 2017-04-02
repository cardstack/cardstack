/*
   This converts a document from elaticsearch to a JSONAPI document.

   The conversion is necessary because in ES we flatten down the
   attributes and relationships, we store some derived fields (to
   enable different kinds of searches), and we may rewrite field names
   (to allow us to have different mapping types on different
   branches simultaneously in one index).

   This function is designed to be synchronous and referentially
   transparent -- any information needed to do the conversion must be
   in the document itself.

   We should benchmark this in a meaningful scenario to see if it
   would be better to precompute this transformation and store it
   within a non-indexed, stored field in ES.
*/

module.exports = function searchDocToJSONAPI(type, document) {
  let rewrites = document.cardstack_rewrites;
  let attributes;
  let relationships;
  let top = { type };
  Object.keys(document).forEach(fieldName => {
    if (fieldName === 'cardstack_rewrites' || fieldName === 'cardstack_meta') {
      return;
    }
    let outputName = fieldName;
    let rewrite = rewrites[fieldName];
    if (rewrite) {
      if (rewrite.delete) {
        return;
      }
      if (rewrite.rename) {
        outputName = rewrite.rename;
      }
    }
    if (rewrite && rewrite.isRelationship) {
      if (!relationships) {
        relationships = {};
      }
      relationships[outputName] = document[fieldName];
    } else {
      if (outputName === 'id') {
        top.id = document[fieldName];
      } else {
        if (!attributes) {
          attributes = {};
        }
        attributes[outputName] = document[fieldName];
      }
    }
  });
  if (attributes) {
    top.attributes = attributes;
  }
  if (relationships) {
    top.relationships = relationships;
  }
  if (document.cardstack_meta) {
    top.meta = document.cardstack_meta;
  }
  return top;
};
