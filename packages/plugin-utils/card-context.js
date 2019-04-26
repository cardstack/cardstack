/*
 * Model ID's will be in the format:
 *   source::package-name::card-id::model-id:::snapshot-version
*/

const Error = require('./error');
const cardContextDelim = '::';
const cardVersionDelim = ':::';
const currentVersionLabel = '_current_';

function cardContextFromId(id) {
  let [ idPart='', snapshotVersion ] = id.split(cardVersionDelim);
  let [ sourceId, packageName, cardId, modelId ] = idPart.split(cardContextDelim);

  return {
    sourceId,
    packageName,
    cardId,
    modelId,
    snapshotVersion
  };
}

function cardContextToId({
  sourceId,
  packageName,
  cardId,
  modelId,
  snapshotVersion
}) {
  if (sourceId == null) {
    throw new Error(`Not enough card context provided to build id. Missing sourceId for ${sourceId}/${packageName}/${cardId}`);
  }
  if (packageName == null) {
    throw new Error(`Not enough card context provided to build id. Missing packageName for ${sourceId}/${packageName}/${cardId}`);
  }

  let idPart = [ sourceId, packageName, cardId, modelId ].filter(i => i != null).join(cardContextDelim);
  return [ idPart, snapshotVersion ].filter(i => i != null).join(cardVersionDelim);
}
module.exports = {
  currentVersionLabel,
  cardContextFromId,
  cardContextToId,
  cardContextDelim
};